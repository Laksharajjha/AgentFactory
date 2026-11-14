import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth_service import AuthenticatedContext, AuthService
from app.config import settings
from app.database import privileged_rls_context
from app.llm.gemini_provider import GeminiProvider, redact_secrets
from app.llm.model_catalog import (
    ALLOWED_GEMINI_MODELS,
    DEFAULT_GEMINI_MODEL,
    serialize_model_catalog,
    validate_gemini_model_id,
)
from app.models import IntegrationCredentialModel, WorkspaceMemberModel, WorkspaceModel

logger = logging.getLogger("project_forge.provider_resolver")


def _get_fernet() -> Fernet:
    return Fernet(settings.derive_fernet_key())


def encrypt_provider_credential(payload: Dict[str, Any]) -> str:
    raw = json.dumps(payload).encode("utf-8")
    return _get_fernet().encrypt(raw).decode("ascii")


def decrypt_provider_credential(ciphertext: str) -> Dict[str, Any]:
    raw = _get_fernet().decrypt(ciphertext.encode("ascii"))
    return json.loads(raw.decode("utf-8"))


class WorkspaceProviderResolver:
    """
    Central Workspace-Scoped AI Provider Resolver (BYOK Architecture).

    Responsibilities:
    - Verifies authenticated user access to the target workspace.
    - Encrypts/decrypts provider credentials in `integration_credentials` using Fernet (`CREDENTIAL_ENCRYPTION_KEY`).
    - Resolves workspace-specific model configuration from `workspaces.settings_json` and `integration_credentials`.
    - Caches isolated `GeminiProvider` instances strictly keyed by `(workspace_id, provider, credential_version, model_id, live_enabled)`.
    - Automatically invalidates old cached provider instances whenever credentials rotate or are deleted.
    - Never uses another workspace's credentials or mutates a process-wide API-key singleton.
    """

    # Cache key -> GeminiProvider instance (never includes plaintext API key in cache key)
    _provider_cache: Dict[Tuple[str, str, int, str, bool], GeminiProvider] = {}

    @classmethod
    def invalidate_workspace_cache(cls, workspace_id: str, provider: str = "gemini") -> int:
        ws_id = (workspace_id or "").strip()
        prov = (provider or "gemini").strip().lower()
        to_remove = [
            k for k in cls._provider_cache.keys() if k[0] == ws_id and k[1] == prov
        ]
        for k in to_remove:
            cls._provider_cache.pop(k, None)
        return len(to_remove)

    @classmethod
    async def verify_workspace_access(
        cls,
        session: AsyncSession,
        workspace_id: str,
        ctx: Optional[AuthenticatedContext] = None,
        require_admin: bool = False,
    ) -> WorkspaceModel:
        ws_id = (workspace_id or "").strip()
        if not ws_id:
            raise HTTPException(status_code=400, detail="Workspace ID is required.")

        if ctx is not None:
            is_platform_admin = ctx.platform_role in ("PLATFORM_ADMIN", "PLATFORM_OPERATOR")
            if ctx.workspace_id != ws_id and not is_platform_admin:
                # Verify explicit membership in target workspace
                async with privileged_rls_context(session):
                    mem = (
                        await session.execute(
                            select(WorkspaceMemberModel).where(
                                WorkspaceMemberModel.workspace_id == ws_id,
                                WorkspaceMemberModel.user_id == ctx.user_id,
                            )
                        )
                    ).scalar_one_or_none()
                if not mem:
                    await AuthService.record_audit(
                        session=session,
                        tenant_id=ctx.tenant_id,
                        user_id=ctx.user_id,
                        workspace_id=ctx.workspace_id,
                        actor_type="USER",
                        actor_id=ctx.user_id,
                        action="CROSS_TENANT_CREDENTIAL_ACCESS_BLOCKED",
                        resource_type="integration_credential",
                        resource_id=ws_id,
                        status="DENIED",
                        details={"requested_workspace_id": ws_id},
                    )
                    raise HTTPException(
                        status_code=403,
                        detail="Forbidden: You do not have access to this workspace's AI provider configuration.",
                    )
                ws_role = (mem.role or "VIEWER").upper()
            else:
                ws_role = (ctx.workspace_role or "MEMBER").upper()

            if require_admin and not (ws_role in ("OWNER", "ADMIN") or is_platform_admin):
                await AuthService.record_audit(
                    session=session,
                    tenant_id=ctx.tenant_id,
                    user_id=ctx.user_id,
                    workspace_id=ctx.workspace_id,
                    actor_type="USER",
                    actor_id=ctx.user_id,
                    action="LLM_SETTINGS_UPDATE_DENIED",
                    resource_type="integration_credential",
                    resource_id=ws_id,
                    status="DENIED",
                    details={"workspace_role": ws_role, "platform_role": ctx.platform_role, "target_workspace_id": ws_id},
                )
                raise HTTPException(
                    status_code=403,
                    detail="Forbidden: Only workspace administrators (OWNER/ADMIN) can modify AI provider credentials or model settings.",
                )

        ws = (
            await session.execute(select(WorkspaceModel).where(WorkspaceModel.id == ws_id))
        ).scalar_one_or_none()
        if not ws and ctx is not None and ctx.workspace_id != ws_id:
            async with privileged_rls_context(session):
                ws = (
                    await session.execute(select(WorkspaceModel).where(WorkspaceModel.id == ws_id))
                ).scalar_one_or_none()
        if not ws:
            raise HTTPException(status_code=404, detail="Workspace not found.")
        return ws

    @classmethod
    async def _get_credential_row(
        cls,
        session: AsyncSession,
        workspace_id: str,
        provider: str = "gemini",
    ) -> Optional[IntegrationCredentialModel]:
        res = await session.execute(
            select(IntegrationCredentialModel)
            .where(
                IntegrationCredentialModel.workspace_id == workspace_id,
                IntegrationCredentialModel.provider == provider.lower().strip(),
            )
            .order_by(IntegrationCredentialModel.updated_at.desc())
        )
        return res.scalars().first()

    @classmethod
    def _extract_workspace_llm_settings(cls, ws: WorkspaceModel) -> Dict[str, Any]:
        s_json = dict(ws.settings_json or {})
        llm_cfg = dict(s_json.get("llm") or {})
        model_id = str(llm_cfg.get("selected_model") or DEFAULT_GEMINI_MODEL).strip()
        if model_id not in ALLOWED_GEMINI_MODELS:
            model_id = DEFAULT_GEMINI_MODEL
        return {
            "provider": str(llm_cfg.get("provider") or "gemini").strip().lower(),
            "selected_model": model_id,
            "enable_complex_model": bool(llm_cfg.get("enable_complex_model", False)),
            "enable_live_execution": llm_cfg.get("enable_live_execution", True),
            "allow_member_execution": bool(llm_cfg.get("allow_member_execution", True)),
        }

    @classmethod
    async def resolve_for_workspace(
        cls,
        session: AsyncSession,
        workspace_id: str,
        provider: str = "gemini",
        ctx: Optional[AuthenticatedContext] = None,
    ) -> GeminiProvider:
        """
        Resolves and returns a strictly isolated GeminiProvider instance for `workspace_id`.
        Used by all foreground routes and background execution jobs.
        """
        prov = (provider or "gemini").strip().lower()
        if prov != "gemini":
            raise HTTPException(status_code=422, detail=f"Unsupported AI provider '{prov}'. Supported: ['gemini']")

        ws = await cls.verify_workspace_access(session, workspace_id, ctx=ctx, require_admin=False)
        ws_llm = cls._extract_workspace_llm_settings(ws)

        # Check workspace policy if a non-admin member is invoking
        if ctx is not None and ctx.workspace_role.upper() not in ("OWNER", "ADMIN"):
            if not ws_llm.get("allow_member_execution", True):
                raise HTTPException(
                    status_code=403,
                    detail="Workspace policy restricts AI provider usage to workspace administrators.",
                )

        cred_row = await cls._get_credential_row(session, ws.id, prov)
        decrypted_key = ""
        cred_version = 0
        cred_source = "none"
        model_id = ws_llm["selected_model"]
        live_enabled = bool(ws_llm.get("enable_live_execution", True))

        if cred_row and cred_row.encrypted_payload:
            try:
                payload = decrypt_provider_credential(cred_row.encrypted_payload)
                decrypted_key = str(payload.get("api_key") or "").strip()
                cred_version = int(payload.get("credential_version") or 1)
                if payload.get("selected_model") and payload["selected_model"] in ALLOWED_GEMINI_MODELS:
                    model_id = str(payload["selected_model"]).strip()
                if "enable_live_execution" in payload and payload["enable_live_execution"] is not None:
                    live_enabled = bool(payload["enable_live_execution"])
                cred_source = "workspace_byok"
            except InvalidToken:
                logger.error("Failed to decrypt integration_credential for workspace %s", ws.id)
                decrypted_key = ""
                cred_version = 0

        cache_key = (ws.id, prov, cred_version, model_id, bool(decrypted_key) and live_enabled)
        cached = cls._provider_cache.get(cache_key)
        if cached is not None:
            return cached

        # Evict any stale entries for this (workspace_id, provider) before storing the new version
        cls.invalidate_workspace_cache(ws.id, prov)

        instance = GeminiProvider(
            workspace_id=ws.id,
            api_key=decrypted_key,
            model_id=model_id,
            complex_model_id=model_id,
            enable_complex_model=ws_llm["enable_complex_model"],
            live_execution_enabled=bool(decrypted_key) and live_enabled,
            credential_version=cred_version,
            credential_source=cred_source,
        )
        cls._provider_cache[cache_key] = instance
        return instance

    @classmethod
    async def get_credential_status(
        cls,
        session: AsyncSession,
        workspace_id: str,
        provider: str = "gemini",
        ctx: Optional[AuthenticatedContext] = None,
    ) -> Dict[str, Any]:
        """Returns workspace BYOK credential status without ever exposing plaintext or encrypted keys."""
        ws = await cls.verify_workspace_access(session, workspace_id, ctx=ctx, require_admin=False)
        ws_llm = cls._extract_workspace_llm_settings(ws)
        cred_row = await cls._get_credential_row(session, ws.id, provider)

        configured = False
        validation_status = "UNCONFIGURED"
        last_validated_at: Optional[str] = None
        credential_version = 0
        updated_at: Optional[str] = None
        selected_model = ws_llm["selected_model"]
        live_enabled = bool(ws_llm.get("enable_live_execution", True))

        if cred_row and cred_row.encrypted_payload:
            try:
                payload = decrypt_provider_credential(cred_row.encrypted_payload)
                api_key = str(payload.get("api_key") or "").strip()
                configured = bool(len(api_key) >= 12)
                validation_status = str(payload.get("validation_status") or ("CONFIGURED" if configured else "UNCONFIGURED"))
                last_validated_at = payload.get("last_validated_at")
                credential_version = int(payload.get("credential_version") or 1)
                if payload.get("selected_model") and payload["selected_model"] in ALLOWED_GEMINI_MODELS:
                    selected_model = str(payload["selected_model"]).strip()
                if "enable_live_execution" in payload and payload["enable_live_execution"] is not None:
                    live_enabled = bool(payload["enable_live_execution"])
                updated_at = cred_row.updated_at.isoformat() if cred_row.updated_at else None
            except Exception:
                configured = False
                validation_status = "DECRYPTION_ERROR"

        prov_instance = await cls.resolve_for_workspace(session, ws.id, provider=provider, ctx=ctx)
        rate_limits = prov_instance.get_model_limits(selected_model)

        return {
            "status": "ok",
            "workspace_id": ws.id,
            "provider": "gemini",
            "configured": configured,
            "has_api_key": configured,
            "masked_status": "Configured (Encrypted)" if configured else "Not Configured",
            "gemini_live_configured": configured and live_enabled,
            "enable_live_execution": live_enabled,
            "selected_model": selected_model,
            "active_model": selected_model,
            "enable_complex_model": ws_llm["enable_complex_model"],
            "validation_status": validation_status,
            "last_validated_at": last_validated_at,
            "credential_version": credential_version,
            "updated_at": updated_at,
            "allowed_models": sorted(ALLOWED_GEMINI_MODELS),
            "model_catalog": serialize_model_catalog(),
            "rate_limits": rate_limits,
        }

    @classmethod
    async def configure_or_rotate_credential(
        cls,
        session: AsyncSession,
        ctx: AuthenticatedContext,
        workspace_id: str,
        provider: str = "gemini",
        api_key: Optional[str] = None,
        selected_model: Optional[str] = None,
        enable_live_execution: Optional[bool] = None,
        enable_complex_model: Optional[bool] = None,
        validate_before_save: bool = False,
        is_rotation: bool = False,
    ) -> Dict[str, Any]:
        """Saves, updates, or rotates encrypted workspace AI credentials and model settings."""
        prov = (provider or "gemini").strip().lower()
        if prov != "gemini":
            raise HTTPException(status_code=422, detail=f"Unsupported AI provider '{prov}'. Supported: ['gemini']")

        ws = await cls.verify_workspace_access(session, workspace_id, ctx=ctx, require_admin=True)
        ws_llm = cls._extract_workspace_llm_settings(ws)

        target_model = ws_llm["selected_model"]
        if selected_model is not None:
            try:
                target_model = validate_gemini_model_id(selected_model)
            except ValueError as ve:
                raise HTTPException(status_code=422, detail=str(ve))

        cred_row = await cls._get_credential_row(session, ws.id, prov)
        existing_payload: Dict[str, Any] = {}
        if cred_row and cred_row.encrypted_payload:
            try:
                existing_payload = decrypt_provider_credential(cred_row.encrypted_payload)
            except Exception:
                existing_payload = {}

        effective_key = str(existing_payload.get("api_key") or "").strip()
        key_changed = False
        if api_key is not None:
            cleaned_key = api_key.strip()
            if cleaned_key:
                if len(cleaned_key) < 16 or any(ch.isspace() for ch in cleaned_key):
                    raise HTTPException(
                        status_code=422,
                        detail="Provided Gemini API key does not meet format or minimum length (16 chars) requirements.",
                    )
                key_changed = (cleaned_key != effective_key)
                effective_key = cleaned_key

        prev_version = int(existing_payload.get("credential_version") or 0)
        new_version = (prev_version + 1) if (key_changed or is_rotation or prev_version == 0) else prev_version

        target_live = (
            bool(enable_live_execution)
            if enable_live_execution is not None
            else (True if key_changed else bool(existing_payload.get("enable_live_execution", ws_llm["enable_live_execution"])))
        )
        target_complex = (
            bool(enable_complex_model)
            if enable_complex_model is not None
            else bool(ws_llm["enable_complex_model"])
        )

        validation_status = str(existing_payload.get("validation_status") or ("CONFIGURED" if effective_key else "UNCONFIGURED"))
        last_validated_at = existing_payload.get("last_validated_at")

        if validate_before_save and effective_key:
            temp_provider = GeminiProvider(
                workspace_id=ws.id,
                api_key=effective_key,
                model_id=target_model,
                live_execution_enabled=True,
                credential_version=new_version,
            )
            val_res = await temp_provider.validate_connection()
            now_iso = datetime.now(timezone.utc).isoformat()
            last_validated_at = now_iso
            validation_status = "VALID" if val_res["valid"] else "INVALID"
            if not val_res["valid"]:
                raise HTTPException(
                    status_code=400,
                    detail=val_res["detail"],
                )
        elif key_changed and effective_key:
            validation_status = "CONFIGURED"

        # Update workspace settings_json
        s_json = dict(ws.settings_json or {})
        s_json["llm"] = {
            "provider": "gemini",
            "selected_model": target_model,
            "enable_complex_model": target_complex,
            "enable_live_execution": target_live,
            "allow_member_execution": ws_llm.get("allow_member_execution", True),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        ws.settings_json = s_json
        ws.updated_at = datetime.now(timezone.utc)

        if effective_key:
            new_payload = {
                "provider": "gemini",
                "api_key": effective_key,
                "selected_model": target_model,
                "enable_live_execution": target_live,
                "enable_complex_model": target_complex,
                "credential_version": new_version,
                "validation_status": validation_status,
                "last_validated_at": last_validated_at,
                "updated_by_user_id": ctx.user_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            encrypted_str = encrypt_provider_credential(new_payload)
            if cred_row:
                cred_row.encrypted_payload = encrypted_str
                cred_row.user_id = ctx.user_id
                cred_row.scopes = [f"model:{target_model}", f"version:{new_version}"]
                cred_row.updated_at = datetime.now(timezone.utc)
            else:
                cred_row = IntegrationCredentialModel(
                    id=f"cred_{uuid.uuid4().hex[:10]}",
                    workspace_id=ws.id,
                    user_id=ctx.user_id,
                    provider="gemini",
                    encrypted_payload=encrypted_str,
                    scopes=[f"model:{target_model}", f"version:{new_version}"],
                )
                session.add(cred_row)
        elif cred_row and existing_payload:
            # Update model/live flags inside existing encrypted payload without losing key
            existing_payload["selected_model"] = target_model
            existing_payload["enable_live_execution"] = target_live
            existing_payload["enable_complex_model"] = target_complex
            cred_row.encrypted_payload = encrypt_provider_credential(existing_payload)
            cred_row.updated_at = datetime.now(timezone.utc)

        await session.commit()

        # Invalidate cached provider client for this workspace
        cls.invalidate_workspace_cache(ws.id, prov)

        audit_action = (
            "WORKSPACE_CREDENTIAL_ROTATED"
            if is_rotation
            else "WORKSPACE_CREDENTIAL_CONFIGURED"
            if key_changed
            else "LLM_SETTINGS_UPDATED"
        )
        await AuthService.record_audit(
            session=session,
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            workspace_id=ws.id,
            actor_type="USER",
            actor_id=ctx.user_id,
            action=audit_action,
            resource_type="integration_credential",
            resource_id=cred_row.id if cred_row else ws.id,
            status="COMPLETED",
            details={
                "provider": "gemini",
                "workspace_id": ws.id,
                "active_model": target_model,
                "enable_live_execution": bool(effective_key) and target_live,
                "enable_complex_model": target_complex,
                "api_key_updated": key_changed,
                "credential_version": new_version if effective_key else 0,
            },
        )

        status_resp = await cls.get_credential_status(session, ws.id, provider="gemini", ctx=ctx)
        status_resp["status"] = "updated"
        return status_resp

    @classmethod
    async def test_workspace_credential(
        cls,
        session: AsyncSession,
        ctx: AuthenticatedContext,
        workspace_id: str,
        provider: str = "gemini",
        candidate_api_key: Optional[str] = None,
        candidate_model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Tests either a candidate API key or the workspace's saved encrypted key without leaking credentials."""
        prov = (provider or "gemini").strip().lower()
        if prov != "gemini":
            raise HTTPException(status_code=422, detail=f"Unsupported AI provider '{prov}'.")

        ws = await cls.verify_workspace_access(session, workspace_id, ctx=ctx, require_admin=True)
        ws_llm = cls._extract_workspace_llm_settings(ws)

        target_model = ws_llm["selected_model"]
        if candidate_model is not None and candidate_model.strip():
            try:
                target_model = validate_gemini_model_id(candidate_model)
            except ValueError as ve:
                raise HTTPException(status_code=422, detail=str(ve))

        cred_row = await cls._get_credential_row(session, ws.id, prov)
        existing_payload: Dict[str, Any] = {}
        if cred_row and cred_row.encrypted_payload:
            try:
                existing_payload = decrypt_provider_credential(cred_row.encrypted_payload)
            except Exception:
                existing_payload = {}

        key_to_test = (
            candidate_api_key.strip()
            if (candidate_api_key and candidate_api_key.strip())
            else str(existing_payload.get("api_key") or "").strip()
        )
        if not key_to_test or len(key_to_test) < 16:
            return {
                "valid": False,
                "workspace_id": ws.id,
                "provider": "gemini",
                "selected_model": target_model,
                "validation_status": "MISSING_OR_INVALID_FORMAT",
                "last_validated_at": datetime.now(timezone.utc).isoformat(),
                "detail": "No valid Gemini API key provided or saved for this workspace.",
            }

        test_instance = GeminiProvider(
            workspace_id=ws.id,
            api_key=key_to_test,
            model_id=target_model,
            live_execution_enabled=True,
        )
        val_result = await test_instance.validate_connection()
        now_iso = datetime.now(timezone.utc).isoformat()
        val_status = "VALID" if val_result["valid"] else "INVALID"

        # If testing the currently saved key, persist the updated validation timestamp & status
        if cred_row and existing_payload and key_to_test == existing_payload.get("api_key"):
            existing_payload["validation_status"] = val_status
            existing_payload["last_validated_at"] = now_iso
            cred_row.encrypted_payload = encrypt_provider_credential(existing_payload)
            cred_row.updated_at = datetime.now(timezone.utc)
            await session.commit()

        await AuthService.record_audit(
            session=session,
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            workspace_id=ws.id,
            actor_type="USER",
            actor_id=ctx.user_id,
            action="WORKSPACE_CREDENTIAL_TESTED",
            resource_type="integration_credential",
            resource_id=ws.id,
            status="COMPLETED" if val_result["valid"] else "FAILED",
            details={
                "provider": "gemini",
                "model_id": target_model,
                "validation_status": val_status,
            },
        )

        return {
            "valid": val_result["valid"],
            "workspace_id": ws.id,
            "provider": "gemini",
            "selected_model": target_model,
            "validation_status": val_status,
            "last_validated_at": now_iso,
            "latency_ms": val_result.get("latency_ms"),
            "detail": redact_secrets(val_result.get("detail", ""), key_to_test),
        }

    @classmethod
    async def delete_credential(
        cls,
        session: AsyncSession,
        ctx: AuthenticatedContext,
        workspace_id: str,
        provider: str = "gemini",
    ) -> Dict[str, Any]:
        """Deletes the workspace's stored credential, invalidates cache, and records an audit log."""
        prov = (provider or "gemini").strip().lower()
        ws = await cls.verify_workspace_access(session, workspace_id, ctx=ctx, require_admin=True)

        res = await session.execute(
            select(IntegrationCredentialModel).where(
                IntegrationCredentialModel.workspace_id == ws.id,
                IntegrationCredentialModel.provider == prov,
            )
        )
        rows = list(res.scalars().all())
        deleted_count = len(rows)
        for r in rows:
            await session.delete(r)

        s_json = dict(ws.settings_json or {})
        if "llm" in s_json and isinstance(s_json["llm"], dict):
            s_json["llm"] = {
                **s_json["llm"],
                "enable_live_execution": False,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            ws.settings_json = s_json

        await session.commit()
        cls.invalidate_workspace_cache(ws.id, prov)

        await AuthService.record_audit(
            session=session,
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            workspace_id=ws.id,
            actor_type="USER",
            actor_id=ctx.user_id,
            action="WORKSPACE_CREDENTIAL_DELETED",
            resource_type="integration_credential",
            resource_id=ws.id,
            status="COMPLETED",
            details={"provider": prov, "deleted_count": deleted_count},
        )

        status_resp = await cls.get_credential_status(session, ws.id, provider=prov, ctx=ctx)
        status_resp["status"] = "deleted"
        return status_resp
