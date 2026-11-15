import base64
import hashlib
import hmac
import json
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple
from fastapi import Depends, Header, HTTPException, Request, WebSocket
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import apply_rls_context, get_db, privileged_rls_context
from app.models import (
    AuditLogModel,
    OrganizationMemberModel,
    OrganizationModel,
    ResourceBudgetModel,
    SessionModel,
    UserModel,
    UserProfileModel,
    WorkspaceMemberModel,
    WorkspaceModel,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str, salt: Optional[str] = None) -> str:
    salt_val = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_val.encode("utf-8"), 120_000)
    return f"pbkdf2_sha256${salt_val}${dk.hex()}"


def verify_password(password: str, stored_hash: Optional[str]) -> bool:
    if not stored_hash or "$" not in stored_hash:
        return False
    parts = stored_hash.split("$")
    if len(parts) != 3:
        return False
    _, salt_val, _ = parts
    candidate = hash_password(password, salt=salt_val)
    return hmac.compare_digest(candidate, stored_hash)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(val: str) -> bytes:
    pad = "=" * ((4 - len(val) % 4) % 4)
    return base64.urlsafe_b64decode((val + pad).encode("ascii"))


def create_jwt_token(
    user_id: str,
    workspace_id: str,
    session_id: str,
    platform_role: str = "USER",
    expires_hours: int = 72,
) -> Tuple[str, datetime]:
    now_ts = int(time.time())
    exp_dt = utc_now() + timedelta(hours=expires_hours)
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "wid": workspace_id,
        "sid": session_id,
        "prole": platform_role,
        "iat": now_ts,
        "exp": int(exp_dt.timestamp()),
    }
    h_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{h_b64}.{p_b64}".encode("ascii")
    sig = hmac.new(settings.AUTH_SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    token = f"{h_b64}.{p_b64}.{_b64url_encode(sig)}"
    return token, exp_dt


def decode_and_verify_jwt(token: str) -> Optional[Dict[str, Any]]:
    try:
        parts = token.strip().split(".")
        if len(parts) != 3:
            return None
        h_b64, p_b64, s_b64 = parts
        signing_input = f"{h_b64}.{p_b64}".encode("ascii")
        expected_sig = hmac.new(
            settings.AUTH_SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256
        ).digest()
        actual_sig = _b64url_decode(s_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        payload = json.loads(_b64url_decode(p_b64).decode("utf-8"))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class AuthenticatedContext:
    def __init__(
        self,
        user: UserModel,
        workspace: WorkspaceModel,
        workspace_role: str,
        session_id: Optional[str] = None,
    ) -> None:
        self.user = user
        self.user_id = user.id
        self.workspace = workspace
        self.workspace_id = workspace.id
        self.tenant_id = workspace.tenant_id
        self.workspace_role = workspace_role  # OWNER, ADMIN, MEMBER, VIEWER
        self.platform_role = user.platform_role or "USER"  # PLATFORM_ADMIN, PLATFORM_OPERATOR, USER
        self.session_id = session_id


class AuthService:
    """Enterprise Authentication, Session Lifecycle, and Personal Workspace Provisioner."""

    @staticmethod
    async def record_audit(
        session: AsyncSession,
        tenant_id: str,
        user_id: Optional[str],
        workspace_id: Optional[str],
        actor_type: str,
        actor_id: str,
        action: str,
        resource_type: str,
        resource_id: str,
        status: str = "ALLOWED",
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        log = AuditLogModel(
            id=f"aud_{uuid.uuid4().hex[:12]}",
            tenant_id=tenant_id,
            user_id=user_id,
            workspace_id=workspace_id,
            actor_type=actor_type,
            actor_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            status=status,
            details=details or {},
        )
        session.add(log)
        await session.commit()

    @staticmethod
    async def ensure_personal_workspace_for_user(
        session: AsyncSession,
        user: UserModel,
    ) -> Tuple[WorkspaceModel, str]:
        if user.default_workspace_id:
            ws_res = await session.execute(
                select(WorkspaceModel).where(WorkspaceModel.id == user.default_workspace_id)
            )
            ws = ws_res.scalar_one_or_none()
            if ws:
                mem_res = await session.execute(
                    select(WorkspaceMemberModel).where(
                        WorkspaceMemberModel.workspace_id == ws.id,
                        WorkspaceMemberModel.user_id == user.id,
                    )
                )
                mem = mem_res.scalar_one_or_none()
                return ws, (mem.role if mem else "OWNER")

        # Check any existing workspace owned by user
        ws_res = await session.execute(
            select(WorkspaceModel).where(WorkspaceModel.owner_user_id == user.id)
        )
        ws = ws_res.scalars().first()
        if not ws:
            slug_base = (user.name or "engineer").lower().replace(" ", "-")[:24]
            org_id = f"org_{uuid.uuid4().hex[:10]}"
            ws_id = f"ws_{uuid.uuid4().hex[:10]}"
            tenant_id = f"ten_{user.id}"

            org = OrganizationModel(
                id=org_id,
                name=f"{user.name} Organization",
                slug=f"{slug_base}-{uuid.uuid4().hex[:6]}",
                owner_user_id=user.id,
                plan_tier="FREE_TIER",
            )
            session.add(org)
            await session.flush()

            org_mem = OrganizationMemberModel(
                id=f"om_{uuid.uuid4().hex[:10]}",
                organization_id=org_id,
                user_id=user.id,
                role="OWNER",
            )
            session.add(org_mem)

            ws = WorkspaceModel(
                id=ws_id,
                tenant_id=tenant_id,
                organization_id=org_id,
                owner_user_id=user.id,
                name=f"{user.name}'s HQ Workspace",
                slug=f"{slug_base}-hq",
                description="Isolated multi-tenant AI engineering office and execution workspace.",
                is_personal=True,
                settings_json={"default_branch_prefix": "forge/", "require_pr_approval": True},
            )
            session.add(ws)
            await session.flush()

            ws_mem = WorkspaceMemberModel(
                id=f"wm_{uuid.uuid4().hex[:10]}",
                workspace_id=ws.id,
                user_id=user.id,
                role="OWNER",
            )
            session.add(ws_mem)

            prof_res = await session.execute(
                select(UserProfileModel).where(UserProfileModel.user_id == user.id)
            )
            if not prof_res.scalar_one_or_none():
                session.add(
                    UserProfileModel(
                        id=f"up_{uuid.uuid4().hex[:10]}",
                        user_id=user.id,
                        title=user.role or "Principal Architect",
                        department="Autonomous Engineering",
                        preferences={"theme": "enterprise-dark"},
                    )
                )

            bud_res = await session.execute(
                select(ResourceBudgetModel).where(ResourceBudgetModel.user_id == user.id)
            )
            if not bud_res.scalar_one_or_none():
                session.add(
                    ResourceBudgetModel(
                        id=f"rb_{uuid.uuid4().hex[:10]}",
                        user_id=user.id,
                        workspace_id=ws.id,
                        max_tokens_per_day=250_000,
                        max_concurrent_executions=settings.MAX_CONCURRENT_EXECUTIONS_PER_USER,
                        max_queued_executions=settings.MAX_QUEUED_WORKFORCES_PER_USER,
                    )
                )

        user.default_workspace_id = ws.id
        await session.commit()
        return ws, "OWNER"

    @staticmethod
    async def register_user(
        session: AsyncSession,
        name: str,
        email: str,
        password: str,
        role_title: str = "Engineering Lead",
        platform_role: str = "USER",
    ) -> Dict[str, Any]:
        clean_email = email.strip().lower()
        if not clean_email or "@" not in clean_email:
            raise HTTPException(status_code=422, detail="A valid email address is required.")
        if not password or len(password) < 8:
            raise HTTPException(status_code=422, detail="Password must be at least 8 characters long.")

        async with privileged_rls_context(session):
            existing = (
                await session.execute(select(UserModel).where(UserModel.email == clean_email))
            ).scalar_one_or_none()
            if existing:
                raise HTTPException(status_code=409, detail="An account with this email already exists.")

            user_id = f"usr_{uuid.uuid4().hex[:10]}"
            user = UserModel(
                id=user_id,
                name=name.strip(),
                email=clean_email,
                password_hash=hash_password(password),
                role=role_title,
                platform_role=platform_role,
                email_verified=True,
                auth_provider="local",
                is_active=True,
            )
            session.add(user)
            await session.flush()

            ws, ws_role = await AuthService.ensure_personal_workspace_for_user(session, user)
            token_data = await AuthService.issue_session(session, user, ws)

            await AuthService.record_audit(
                session=session,
                tenant_id=ws.tenant_id,
                user_id=user.id,
                workspace_id=ws.id,
                actor_type="USER",
                actor_id=user.id,
                action="USER_REGISTERED",
                resource_type="user",
                resource_id=user.id,
                status="COMPLETED",
                details={"email": clean_email, "workspace_id": ws.id},
            )

        await apply_rls_context(session, user.id, ws.id, user.platform_role or "USER")
        token_data["workspace"]["role"] = ws_role
        return {**token_data, "workspace_role": ws_role}

    @staticmethod
    async def login_user(
        session: AsyncSession,
        email: str,
        password: str,
    ) -> Dict[str, Any]:
        clean_email = email.strip().lower()
        async with privileged_rls_context(session):
            user = (
                await session.execute(select(UserModel).where(UserModel.email == clean_email))
            ).scalar_one_or_none()
            if not user or not verify_password(password, user.password_hash):
                raise HTTPException(status_code=401, detail="Invalid email or password.")
            if not user.is_active:
                raise HTTPException(status_code=403, detail="Account is suspended.")

            ws, ws_role = await AuthService.ensure_personal_workspace_for_user(session, user)
            token_data = await AuthService.issue_session(session, user, ws)
            await AuthService.record_audit(
                session=session,
                tenant_id=ws.tenant_id,
                user_id=user.id,
                workspace_id=ws.id,
                actor_type="USER",
                actor_id=user.id,
                action="USER_LOGIN",
                resource_type="session",
                resource_id=token_data["session_id"],
                status="COMPLETED",
            )

        await apply_rls_context(session, user.id, ws.id, user.platform_role or "USER")
        token_data["workspace"]["role"] = ws_role
        return {**token_data, "workspace_role": ws_role}

    @staticmethod
    async def oauth_login(
        session: AsyncSession,
        provider: str,
        email: str,
        name: str,
    ) -> Dict[str, Any]:
        """Disabled per Phase 1 Security Lockdown: Never issue JWTs from unverified client-supplied identity fields."""
        async with privileged_rls_context(session):
            await AuthService.record_audit(
                session=session,
                tenant_id="unverified_oauth",
                user_id=None,
                workspace_id=None,
                actor_type="ANONYMOUS",
                actor_id="anonymous",
                action="OAUTH_LOGIN_REJECTED_UNVERIFIED",
                resource_type="oauth",
                resource_id=provider or "unknown",
                status="DENIED",
                details={"provider": provider, "reason": "unverified_client_supplied_identity_rejected"},
            )
        raise HTTPException(
            status_code=403,
            detail=(
                "OAuth login is disabled until provider authorization-code exchange and "
                "cryptographic ID-token verification are configured. Use email and password authentication."
            ),
        )

    @staticmethod
    async def issue_session(
        session: AsyncSession,
        user: UserModel,
        workspace: WorkspaceModel,
    ) -> Dict[str, Any]:
        session_id = f"ses_{uuid.uuid4().hex[:12]}"
        jwt_token, exp_dt = create_jwt_token(
            user_id=user.id,
            workspace_id=workspace.id,
            session_id=session_id,
            platform_role=user.platform_role or "USER",
            expires_hours=settings.SESSION_EXPIRY_HOURS,
        )
        sess_row = SessionModel(
            id=session_id,
            user_id=user.id,
            workspace_id=workspace.id,
            token_hash=hash_session_token(jwt_token),
            is_revoked=False,
            expires_at=exp_dt,
        )
        session.add(sess_row)
        await session.commit()

        return {
            "access_token": jwt_token,
            "token_type": "bearer",
            "session_id": session_id,
            "expires_at": exp_dt.isoformat(),
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role,
                "platform_role": user.platform_role or "USER",
                "auth_provider": user.auth_provider,
                "default_workspace_id": workspace.id,
            },
            "workspace": {
                "id": workspace.id,
                "tenant_id": workspace.tenant_id,
                "name": workspace.name,
                "slug": workspace.slug,
                "owner_user_id": workspace.owner_user_id,
            },
        }

    @staticmethod
    async def revoke_session(session: AsyncSession, session_id: str, user_id: str) -> bool:
        res = await session.execute(
            select(SessionModel).where(
                SessionModel.id == session_id,
                SessionModel.user_id == user_id,
            )
        )
        row = res.scalar_one_or_none()
        if not row:
            return False
        row.is_revoked = True
        await session.commit()
        return True

    @staticmethod
    @staticmethod
    async def verify_token_and_resolve_context(
        session: AsyncSession,
        token: str,
        x_workspace_id: Optional[str] = None,
    ) -> AuthenticatedContext:
        if not token or not token.strip():
            raise HTTPException(status_code=401, detail="Authentication token required.")

        claims = decode_and_verify_jwt(token)
        if not claims:
            raise HTTPException(status_code=401, detail="Invalid or expired authentication token.")

        session_id = claims.get("sid")
        user_id = claims.get("sub")
        target_ws_id = x_workspace_id or claims.get("wid")
        if not session_id or not user_id or not target_ws_id:
            raise HTTPException(status_code=401, detail="Malformed authentication token claims.")

        async with privileged_rls_context(session):
            sess_res = await session.execute(
                select(SessionModel).where(
                    SessionModel.id == session_id,
                    SessionModel.user_id == user_id,
                    SessionModel.is_revoked == False,  # noqa: E712
                )
            )
            sess_row = sess_res.scalar_one_or_none()
            if not sess_row:
                raise HTTPException(status_code=401, detail="Session has been revoked or expired.")

            now_utc = utc_now()
            exp_at = sess_row.expires_at
            if exp_at is not None:
                if exp_at.tzinfo is None:
                    exp_at = exp_at.replace(tzinfo=timezone.utc)
                if exp_at < now_utc:
                    raise HTTPException(status_code=401, detail="Session has expired.")

            sess_row.last_active_at = now_utc

            user_res = await session.execute(select(UserModel).where(UserModel.id == user_id))
            user = user_res.scalar_one_or_none()
            if not user or not user.is_active:
                raise HTTPException(status_code=401, detail="Authenticated user is inactive.")

            ws_res = await session.execute(select(WorkspaceModel).where(WorkspaceModel.id == target_ws_id))
            workspace = ws_res.scalar_one_or_none()
            if not workspace:
                raise HTTPException(status_code=404, detail="Target workspace not found.")

            mem_res = await session.execute(
                select(WorkspaceMemberModel).where(
                    WorkspaceMemberModel.workspace_id == workspace.id,
                    WorkspaceMemberModel.user_id == user.id,
                )
            )
            member = mem_res.scalar_one_or_none()
            if not member and workspace.owner_user_id != user.id:
                await AuthService.record_audit(
                    session=session,
                    tenant_id=workspace.tenant_id,
                    user_id=user.id,
                    workspace_id=workspace.id,
                    actor_type="USER",
                    actor_id=user.id,
                    action="UNAUTHORIZED_WORKSPACE_ACCESS",
                    resource_type="workspace",
                    resource_id=workspace.id,
                    status="DENIED",
                )
                raise HTTPException(
                    status_code=403,
                    detail="Access denied: You are not a member of this workspace.",
                )

            ws_role = member.role if member else "OWNER"

        # Bind verified tenant context to the session and all subsequent transactions in this request
        await apply_rls_context(
            session=session,
            user_id=user.id,
            workspace_id=workspace.id,
            platform_role=user.platform_role or "USER",
            bypass_rls=False,
        )
        return AuthenticatedContext(
            user=user,
            workspace=workspace,
            workspace_role=ws_role,
            session_id=session_id,
        )


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


async def get_auth_context(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_workspace_id: Optional[str] = Header(default=None),
    session: AsyncSession = Depends(get_db),
) -> AuthenticatedContext:
    """Strictly requires a valid Bearer JWT token on all protected HTTP routes. Never falls back to anonymous admin."""
    token = _extract_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication token required.")
    return await AuthService.verify_token_and_resolve_context(
        session=session,
        token=token,
        x_workspace_id=x_workspace_id,
    )


async def get_optional_auth_context(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_workspace_id: Optional[str] = Header(default=None),
    session: AsyncSession = Depends(get_db),
) -> Optional[AuthenticatedContext]:
    """Used exclusively by signed artifact downloads where either a Bearer token OR an HMAC signature is required."""
    token = _extract_bearer_token(authorization)
    if not token:
        return None
    return await AuthService.verify_token_and_resolve_context(
        session=session,
        token=token,
        x_workspace_id=x_workspace_id,
    )


async def authenticate_websocket(
    session: AsyncSession,
    websocket: WebSocket,
) -> AuthenticatedContext:
    """Authenticates a WebSocket connection using Authorization header, Sec-WebSocket-Protocol, or query token."""
    token = _extract_bearer_token(websocket.headers.get("authorization"))
    if not token:
        proto = websocket.headers.get("sec-websocket-protocol") or ""
        parts = [p.strip() for p in proto.split(",") if p.strip()]
        if len(parts) >= 2 and parts[0].lower() == "bearer":
            token = parts[1]
    if not token:
        token = websocket.query_params.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="WebSocket authentication token required.")

    x_workspace_id = websocket.headers.get("x-workspace-id") or websocket.query_params.get("workspace_id")
    return await AuthService.verify_token_and_resolve_context(
        session=session,
        token=token,
        x_workspace_id=x_workspace_id,
    )


async def require_authenticated_user(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_workspace_id: Optional[str] = Header(default=None),
    session: AsyncSession = Depends(get_db),
) -> AuthenticatedContext:
    """Strict dependency requiring an explicit valid Bearer JWT token."""
    return await get_auth_context(
        request=request,
        authorization=authorization,
        x_workspace_id=x_workspace_id,
        session=session,
    )
