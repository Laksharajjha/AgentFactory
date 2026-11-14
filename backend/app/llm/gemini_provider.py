import asyncio
import json
import logging
import os
import time
from collections import deque
from typing import Any, Deque, Dict, List, Optional, Tuple, Type
from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.llm.budget_manager import BudgetExhaustedError, BudgetManager
from app.llm.provider import BaseLLMProvider
from app.llm.token_tracker import TokenTracker

logger = logging.getLogger("project_forge.llm")

# User's Exact Google AI Studio Free Tier Rate Limits
FREE_TIER_MODEL_LIMITS: Dict[str, Dict[str, Any]] = {
    "gemini-3.1-flash-lite-preview": {
        "label": "Gemini 3.1 Flash Lite",
        "rpm": 15,
        "tpm": 250_000,
        "rpd": 500,
        "min_interval_sec": 4.2,
    },
    "gemini-3.1-flash-lite": {
        "label": "Gemini 3.1 Flash Lite",
        "rpm": 15,
        "tpm": 250_000,
        "rpd": 500,
        "min_interval_sec": 4.2,
    },
    "gemini-3.5-flash-lite": {
        "label": "Gemini 3.5 Flash Lite",
        "rpm": 15,
        "tpm": 250_000,
        "rpd": 500,
        "min_interval_sec": 4.2,
    },
    "gemini-2.5-flash-lite": {
        "label": "Gemini 2.5 Flash Lite",
        "rpm": 10,
        "tpm": 250_000,
        "rpd": 20,
        "min_interval_sec": 6.2,
    },
    "gemini-2.5-flash": {
        "label": "Gemini 2.5 Flash",
        "rpm": 5,
        "tpm": 250_000,
        "rpd": 20,
        "min_interval_sec": 12.5,
    },
    "gemini-3-flash-preview": {
        "label": "Gemini 3 Flash",
        "rpm": 5,
        "tpm": 250_000,
        "rpd": 20,
        "min_interval_sec": 12.5,
    },
}

# Models with 0/0 quota on the user's Free Tier must automatically reroute to 3.1 Flash Lite
ZERO_QUOTA_FREE_TIER_MODELS = {
    "gemini-2.5-pro",
    "gemini-3.1-pro",
    "gemini-3.1-pro-preview",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
}

FALLBACK_MODEL_CHAIN: List[str] = [
    "gemini-3.1-flash-lite-preview",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
]


class GeminiProvider(BaseLLMProvider):
    """Official Google GenAI SDK Gateway with Free-Tier RPM/TPM/RPD rate-limit pacing, retry logic, and structured output validation."""

    def __init__(self) -> None:
        self._api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")
        self._live_execution_enabled = bool(self._api_key and len(self._api_key.strip()) > 10)
        self._rate_limit_lock = asyncio.Lock()
        self._last_request_ts: Dict[str, float] = {}
        self._minute_windows: Dict[str, Deque[float]] = {}
        self._daily_counts: Dict[str, int] = {}

    @property
    def api_key(self) -> str:
        return settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "") or self._api_key

    def set_api_key(self, key: str) -> None:
        self._api_key = key.strip()
        settings.GEMINI_API_KEY = self._api_key

    def set_live_execution(self, enabled: bool) -> None:
        self._live_execution_enabled = bool(enabled)

    def has_api_key(self) -> bool:
        return bool(self.api_key and len(self.api_key.strip()) > 10)

    def is_live_configured(self) -> bool:
        return self.has_api_key() and self._live_execution_enabled

    def get_model_limits(self, model_id: Optional[str] = None) -> Dict[str, Any]:
        target = (model_id or settings.GEMINI_MODEL or "gemini-3.1-flash-lite-preview").strip()
        if target in ZERO_QUOTA_FREE_TIER_MODELS:
            target = "gemini-3.1-flash-lite-preview"
        limits = FREE_TIER_MODEL_LIMITS.get(
            target,
            {
                "label": target,
                "rpm": 15,
                "tpm": 250_000,
                "rpd": 500,
                "min_interval_sec": 4.2,
            },
        )
        now = time.monotonic()
        win = self._minute_windows.get(target, deque())
        while win and (now - win[0]) > 60.0:
            win.popleft()
        return {
            **limits,
            "model_id": target,
            "rpm_used": len(win),
            "rpd_used": self._daily_counts.get(target, 0),
        }

    def select_model(self, complex_task: bool = False) -> str:
        chosen = super().select_model(complex_task=complex_task)
        if chosen in ZERO_QUOTA_FREE_TIER_MODELS:
            logger.info(
                "Model %s has 0/0 Free Tier quota; rerouting to gemini-3.1-flash-lite-preview (15 RPM / 500 RPD).",
                chosen,
            )
            return "gemini-3.1-flash-lite-preview"
        return chosen

    async def _acquire_rate_limit_slot(self, model_id: str) -> None:
        """Strictly paces outgoing Gemini calls to adhere to the user's Free Tier RPM & RPD quotas."""
        limits = FREE_TIER_MODEL_LIMITS.get(
            model_id,
            {"rpm": 15, "tpm": 250_000, "rpd": 500, "min_interval_sec": 4.2},
        )
        rpm_limit = max(1, int(limits["rpm"]) - 1)  # Keep 1 RPM safety headroom
        min_interval = float(limits["min_interval_sec"])
        rpd_limit = int(limits["rpd"])

        async with self._rate_limit_lock:
            used_today = self._daily_counts.get(model_id, 0)
            if used_today >= rpd_limit:
                raise RuntimeError(
                    f"Free-Tier daily quota reached for {model_id} ({used_today}/{rpd_limit} RPD)."
                )

            now = time.monotonic()
            win = self._minute_windows.setdefault(model_id, deque())
            while win and (now - win[0]) > 60.0:
                win.popleft()

            # 1) Enforce sliding 60-second RPM window
            if len(win) >= rpm_limit:
                wait_window = 60.2 - (now - win[0])
                if wait_window > 0:
                    logger.info(
                        "Rate-limit pacing (%s): waiting %.2fs to stay within %d RPM Free Tier limit",
                        model_id,
                        wait_window,
                        limits["rpm"],
                    )
                    await asyncio.sleep(wait_window)
                    now = time.monotonic()
                    while win and (now - win[0]) > 60.0:
                        win.popleft()

            # 2) Enforce minimum spacing between consecutive calls to prevent burst 429s
            last_ts = self._last_request_ts.get(model_id, 0.0)
            elapsed = now - last_ts
            if last_ts > 0.0 and elapsed < min_interval:
                wait_spacing = min_interval - elapsed
                logger.info(
                    "Rate-limit spacing (%s): pacing %.2fs between requests (min_interval=%.1fs)",
                    model_id,
                    wait_spacing,
                    min_interval,
                )
                await asyncio.sleep(wait_spacing)
                now = time.monotonic()

            self._last_request_ts[model_id] = now
            win.append(now)
            self._daily_counts[model_id] = used_today + 1

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

        # Build candidate chain starting with primary_model_id followed by free-tier fallbacks
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
                    await self._acquire_rate_limit_slot(active_model_id)
                    client = genai.Client(api_key=self.api_key)
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
                    in_tokens = getattr(usage, "prompt_token_count", None) or max(1, len(prompt + system_instruction) // 4)
                    out_tokens = getattr(usage, "candidates_token_count", None) or max(1, len(response.text or "") // 4)

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
                    )
                    return parsed_obj, telemetry

                except ValidationError as ve:
                    duration_ms = (time.perf_counter() - t0) * 1000.0
                    last_error = f"Structured output validation error: {ve}"
                    logger.warning("Attempt %d validation error for %s: %s", attempt + 1, operation, last_error)
                except Exception as exc:
                    duration_ms = (time.perf_counter() - t0) * 1000.0
                    last_error = str(exc)
                    logger.warning("Attempt %d Gemini API error (%s) for %s: %s", attempt + 1, active_model_id, operation, last_error)
                    if "404" in last_error or "NOT_FOUND" in last_error or "daily quota" in last_error.lower():
                        # Immediately switch to next free-tier model in candidate chain
                        model_idx += 1
                    elif "429" in last_error or "RESOURCE_EXHAUSTED" in last_error:
                        model_idx += 1
                        await asyncio.sleep(4.5 * (attempt + 1))
                    elif attempt < settings.MAX_RETRIES:
                        await asyncio.sleep(1.5 * (attempt + 1))

            # Record failed live API attempt transparently
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
            )
            if fallback_data is None:
                raise RuntimeError(f"Gemini request failed after {settings.MAX_RETRIES + 1} attempts: {last_error}")

        # Deterministic structured fallback when GEMINI_API_KEY is not configured or rate-limited
        t0 = time.perf_counter()
        await asyncio.sleep(0.35)
        duration_ms = (time.perf_counter() - t0) * 1000.0
        if fallback_data is None:
            raise RuntimeError("GEMINI_API_KEY is not configured and no fallback schema was provided.")

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
        )
        return parsed_fallback, telemetry


gemini_provider = GeminiProvider()
