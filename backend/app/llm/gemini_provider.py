import asyncio
import logging
import re
import time
from collections import deque
from typing import Any, Callable, Deque, Dict, List, Optional, Tuple, Type
from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.llm.budget_manager import BudgetExhaustedError, BudgetManager
from app.llm.model_catalog import (
    ALLOWED_GEMINI_MODELS,
    DEFAULT_GEMINI_MODEL,
    FALLBACK_MODEL_CHAIN,
    FREE_TIER_MODEL_LIMITS,
    ZERO_QUOTA_FREE_TIER_MODELS,
)
from app.llm.provider import BaseLLMProvider
from app.llm.token_tracker import TokenTracker

logger = logging.getLogger("project_forge.llm")


def redact_secrets(text: str, secret: Optional[str] = None) -> str:
    """Strictly scrubs any API key or credential string from error messages and logs."""
    if not text:
        return ""
    scrubbed = str(text)
    if secret and len(secret.strip()) >= 6:
        scrubbed = scrubbed.replace(secret.strip(), "[REDACTED_CREDENTIAL]")
    scrubbed = re.sub(r"AIza[A-Za-z0-9_-]{12,}", "[REDACTED_GEMINI_KEY]", scrubbed)
    scrubbed = re.sub(r"key=[A-Za-z0-9_-]{10,}", "key=[REDACTED]", scrubbed)
    return scrubbed


class WorkspaceRateLimiter:
    """Tracks RPM and RPD rate limits isolated per (workspace_id, model_id) plus a global safety ceiling."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._last_request_ts: Dict[str, float] = {}
        self._minute_windows: Dict[str, Deque[float]] = {}
        self._daily_counts: Dict[str, int] = {}

    def _bucket_key(self, workspace_id: str, model_id: str) -> str:
        ws = (workspace_id or "global").strip()
        return f"{ws}:{model_id}"

    def get_usage(self, workspace_id: str, model_id: str) -> Dict[str, int]:
        key = self._bucket_key(workspace_id, model_id)
        now = time.monotonic()
        win = self._minute_windows.get(key, deque())
        while win and (now - win[0]) > 60.0:
            win.popleft()
        return {
            "rpm_used": len(win),
            "rpd_used": self._daily_counts.get(key, 0),
        }

    async def acquire_slot(self, workspace_id: str, model_id: str) -> None:
        limits = FREE_TIER_MODEL_LIMITS.get(
            model_id,
            {"rpm": 15, "tpm": 250_000, "rpd": 500, "min_interval_sec": 4.2},
        )
        rpm_limit = max(1, int(limits["rpm"]) - 1)
        min_interval = float(limits["min_interval_sec"])
        rpd_limit = int(limits["rpd"])
        key = self._bucket_key(workspace_id, model_id)

        async with self._lock:
            used_today = self._daily_counts.get(key, 0)
            if used_today >= rpd_limit:
                raise RuntimeError(
                    f"Workspace daily quota reached for {model_id} ({used_today}/{rpd_limit} RPD)."
                )

            now = time.monotonic()
            win = self._minute_windows.setdefault(key, deque())
            while win and (now - win[0]) > 60.0:
                win.popleft()

            if len(win) >= rpm_limit:
                wait_window = 60.2 - (now - win[0])
                if wait_window > 0:
                    logger.info(
                        "Rate-limit pacing (workspace=%s, model=%s): waiting %.2fs",
                        workspace_id,
                        model_id,
                        wait_window,
                    )
                    await asyncio.sleep(wait_window)
                    now = time.monotonic()
                    while win and (now - win[0]) > 60.0:
                        win.popleft()

            last_ts = self._last_request_ts.get(key, 0.0)
            elapsed = now - last_ts
            if last_ts > 0.0 and elapsed < min_interval:
                wait_spacing = min_interval - elapsed
                await asyncio.sleep(wait_spacing)
                now = time.monotonic()

            self._last_request_ts[key] = now
            win.append(now)
            self._daily_counts[key] = used_today + 1


workspace_rate_limiter = WorkspaceRateLimiter()


class GeminiProvider(BaseLLMProvider):
    """
    Workspace-scoped Google Gemini provider instance.
    Never mutates process-wide API keys or leaks credentials across workspaces.
    """

    # Optional hook exclusively for deterministic mock injection in automated isolation tests
    _mock_transport_hook: Optional[
        Callable[[str, str, str, str, str, Type[BaseModel]], Any]
    ] = None

    def __init__(
        self,
        workspace_id: str = "ws_forge_default",
        api_key: str = "",
        model_id: str = DEFAULT_GEMINI_MODEL,
        complex_model_id: Optional[str] = None,
        enable_complex_model: bool = False,
        live_execution_enabled: Optional[bool] = None,
        credential_version: int = 0,
        credential_source: str = "none",
    ) -> None:
        self.workspace_id = (workspace_id or "ws_forge_default").strip()
        self._api_key = (api_key or "").strip()
        self.model_id = (model_id or DEFAULT_GEMINI_MODEL).strip()
        if self.model_id in ZERO_QUOTA_FREE_TIER_MODELS or self.model_id not in ALLOWED_GEMINI_MODELS:
            self.model_id = DEFAULT_GEMINI_MODEL
        self.complex_model_id = (complex_model_id or self.model_id).strip()
        self.enable_complex_model = bool(enable_complex_model)
        self.credential_version = int(credential_version)
        self.credential_source = credential_source
        if live_execution_enabled is None:
            self._live_execution_enabled = bool(self._api_key and len(self._api_key) >= 12)
        else:
            self._live_execution_enabled = bool(live_execution_enabled and self._api_key and len(self._api_key) >= 12)
        self._sdk_client: Optional[genai.Client] = None

    def has_api_key(self) -> bool:
        return bool(self._api_key and len(self._api_key) >= 12)

    def is_live_configured(self) -> bool:
        return self.has_api_key() and self._live_execution_enabled

    def _get_sdk_client(self) -> genai.Client:
        if self._sdk_client is None:
            self._sdk_client = genai.Client(api_key=self._api_key)
        return self._sdk_client

    def select_model(self, complex_task: bool = False) -> str:
        chosen = self.complex_model_id if (complex_task and self.enable_complex_model) else self.model_id
        if chosen in ZERO_QUOTA_FREE_TIER_MODELS or chosen not in ALLOWED_GEMINI_MODELS:
            return DEFAULT_GEMINI_MODEL
        return chosen

    def get_model_limits(self, model_id: Optional[str] = None) -> Dict[str, Any]:
        target = (model_id or self.model_id or DEFAULT_GEMINI_MODEL).strip()
        if target in ZERO_QUOTA_FREE_TIER_MODELS or target not in ALLOWED_GEMINI_MODELS:
            target = DEFAULT_GEMINI_MODEL
        limits = FREE_TIER_MODEL_LIMITS.get(
            target,
            {
                "label": target,
                "rpm": 15,
                "tpm": 250_000,
                "rpd": 500,
                "min_interval_sec": 4.2,
                "recommended": False,
            },
        )
        usage = workspace_rate_limiter.get_usage(self.workspace_id, target)
        return {
            **limits,
            "model_id": target,
            "workspace_id": self.workspace_id,
            "rpm_used": usage["rpm_used"],
            "rpd_used": usage["rpd_used"],
        }

    async def validate_connection(self) -> Dict[str, Any]:
        """Tests the workspace's configured Gemini API key and model without exposing credentials."""
        if not self.has_api_key():
            return {
                "valid": False,
                "provider": "gemini",
                "model_id": self.model_id,
                "status": "MISSING_KEY",
                "detail": "No Gemini API key is provided for validation.",
            }

        t0 = time.perf_counter()
        try:
            if GeminiProvider._mock_transport_hook is not None:
                res = GeminiProvider._mock_transport_hook(
                    self.workspace_id,
                    self._api_key,
                    self.model_id,
                    "validate_connection",
                    "Verify connectivity.",
                     BaseModel,
                )
                if asyncio.iscoroutine(res):
                    await res
            else:
                client = self._get_sdk_client()
                await client.aio.models.get(model=self.model_id)
            latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
            return {
                "valid": True,
                "provider": "gemini",
                "model_id": self.model_id,
                "status": "VALID",
                "latency_ms": latency_ms,
                "detail": f"Successfully verified Gemini model '{self.model_id}'.",
            }
        except Exception as exc:
            safe_err = redact_secrets(str(exc), self._api_key)
            logger.warning(
                "Gemini credential validation failed for workspace %s (model=%s): %s",
                self.workspace_id,
                self.model_id,
                safe_err,
            )
            return {
                "valid": False,
                "provider": "gemini",
                "model_id": self.model_id,
                "status": "INVALID",
                "detail": f"Gemini validation failed: {safe_err[:240]}",
            }

    async def generate_structured(
        self,
        session: AsyncSession,
        workforce_id: str,
        agent_id: Optional[str],
        operation: str,
        system_instruction: str,
        prompt: str,
        response_schema: Type[BaseModel],
        complex_task: bool = False,
        fallback_data: Optional[Dict[str, Any]] = None,
    ) -> Tuple[BaseModel, Dict[str, Any]]:
        can_run, reason = await BudgetManager.check_can_execute(session, workforce_id, agent_id)
        if not can_run:
            raise BudgetExhaustedError(reason)

        primary_model_id = self.select_model(complex_task=complex_task)
        max_tokens = BudgetManager.get_max_output_tokens()

        candidate_models: List[str] = [primary_model_id]
        for fb_model in FALLBACK_MODEL_CHAIN:
            if fb_model not in candidate_models:
                candidate_models.append(fb_model)

        if self.is_live_configured():
            last_error: Optional[str] = None
            model_idx = 0
            for attempt in range(settings.MAX_RETRIES + 1):
                active_model_id = candidate_models[min(model_idx, len(candidate_models) - 1)]
                t0 = time.perf_counter()
                try:
                    if GeminiProvider._mock_transport_hook is not None:
                        hook_out = GeminiProvider._mock_transport_hook(
                            self.workspace_id,
                            self._api_key,
                            active_model_id,
                            operation,
                            prompt,
                            response_schema,
                        )
                        if asyncio.iscoroutine(hook_out):
                            hook_out = await hook_out
                        duration_ms = (time.perf_counter() - t0) * 1000.0
                        if isinstance(hook_out, BaseModel):
                            parsed_obj = hook_out
                        elif isinstance(hook_out, dict):
                            parsed_obj = response_schema.model_validate(hook_out)
                        elif fallback_data is not None:
                            parsed_obj = response_schema.model_validate(fallback_data)
                        else:
                            parsed_obj = response_schema.model_validate_json(str(hook_out))
                        in_tokens = max(12, len(prompt + system_instruction) // 4)
                        out_tokens = 64
                    else:
                        await workspace_rate_limiter.acquire_slot(self.workspace_id, active_model_id)
                        client = self._get_sdk_client()
                        config = types.GenerateContentConfig(
                            system_instruction=system_instruction,
                            response_mime_type="application/json",
                            response_schema=response_schema,
                            max_output_tokens=max_tokens,
                            temperature=0.3,
                        )
                        response = await client.aio.models.generate_content(
                            model=active_model_id,
                            contents=prompt,
                            config=config,
                        )
                        duration_ms = (time.perf_counter() - t0) * 1000.0
                        usage = getattr(response, "usage_metadata", None)
                        in_tokens = getattr(usage, "prompt_token_count", None) or max(
                            1, len(prompt + system_instruction) // 4
                        )
                        out_tokens = getattr(usage, "candidates_token_count", None) or max(
                            1, len(response.text or "") // 4
                        )
                        raw_text = response.text or "{}"
                        parsed_obj = response_schema.model_validate_json(raw_text)

                    telemetry = await TokenTracker.record_request(
                        session=session,
                        workforce_id=workforce_id,
                        agent_id=agent_id,
                        model_id=active_model_id,
                        operation=operation,
                        input_tokens=int(in_tokens),
                        output_tokens=int(out_tokens),
                        duration_ms=duration_ms,
                        success=True,
                        is_live_api=True,
                        workspace_id=self.workspace_id,
                    )
                    return parsed_obj, telemetry

                except ValidationError as ve:
                    duration_ms = (time.perf_counter() - t0) * 1000.0
                    last_error = f"Structured output validation error: {redact_secrets(str(ve), self._api_key)}"
                    logger.warning(
                        "Attempt %d validation error for %s (workspace=%s): %s",
                        attempt + 1,
                        operation,
                        self.workspace_id,
                        last_error,
                    )
                except Exception as exc:
                    duration_ms = (time.perf_counter() - t0) * 1000.0
                    last_error = redact_secrets(str(exc), self._api_key)
                    logger.warning(
                        "Attempt %d Gemini API error (%s, workspace=%s) for %s: %s",
                        attempt + 1,
                        active_model_id,
                        self.workspace_id,
                        operation,
                        last_error,
                    )
                    if "404" in last_error or "NOT_FOUND" in last_error or "daily quota" in last_error.lower():
                        model_idx += 1
                    elif "429" in last_error or "RESOURCE_EXHAUSTED" in last_error:
                        model_idx += 1
                        await asyncio.sleep(4.5 * (attempt + 1))
                    elif attempt < settings.MAX_RETRIES:
                        await asyncio.sleep(1.5 * (attempt + 1))

            await TokenTracker.record_request(
                session=session,
                workforce_id=workforce_id,
                agent_id=agent_id,
                model_id=primary_model_id,
                operation=f"{operation}_failed",
                input_tokens=0,
                output_tokens=0,
                duration_ms=0.0,
                success=False,
                is_live_api=True,
                error_message=last_error,
                workspace_id=self.workspace_id,
            )
            if fallback_data is None:
                raise RuntimeError(
                    f"Gemini request failed after {settings.MAX_RETRIES + 1} attempts: {last_error}"
                )

        t0 = time.perf_counter()
        await asyncio.sleep(0.05 if GeminiProvider._mock_transport_hook is not None else 0.35)
        duration_ms = (time.perf_counter() - t0) * 1000.0
        if fallback_data is None:
            raise RuntimeError("No workspace Gemini API key is configured and no fallback schema was provided.")

        parsed_fallback = response_schema.model_validate(fallback_data)

        telemetry = await TokenTracker.record_request(
            session=session,
            workforce_id=workforce_id,
            agent_id=agent_id,
            model_id=f"{primary_model_id} (demo-simulation)",
            operation=operation,
            input_tokens=0,
            output_tokens=0,
            duration_ms=duration_ms,
            success=True,
            is_live_api=False,
            workspace_id=self.workspace_id,
        )
        return parsed_fallback, telemetry


# Read-only default status helper for system-level capacity telemetry when no workspace is in scope
gemini_provider = GeminiProvider(
    workspace_id="system",
    api_key="",
    model_id=settings.GEMINI_MODEL or DEFAULT_GEMINI_MODEL,
    live_execution_enabled=False,
)
