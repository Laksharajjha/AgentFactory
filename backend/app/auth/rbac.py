from typing import Any, Optional, Set
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth_service import AuthenticatedContext, AuthService

# Workspace Role Permission Matrix (Part 4 Specification)
WORKSPACE_ROLE_PERMISSIONS: dict[str, Set[str]] = {
    "OWNER": {
        "workspace:manage",
        "integrations:manage",
        "members:manage",
        "project:create",
        "project:delete",
        "workforce:launch",
        "execution:cancel",
        "execution:approve",
        "artifact:write",
        "artifact:read",
        "office:read",
    },
    "ADMIN": {
        "integrations:manage",
        "members:manage",
        "project:create",
        "workforce:launch",
        "execution:cancel",
        "execution:approve",
        "artifact:write",
        "artifact:read",
        "office:read",
    },
    "MEMBER": {
        "project:create",
        "workforce:launch",
        "artifact:write",
        "artifact:read",
        "office:read",
    },
    "VIEWER": {
        "artifact:read",
        "office:read",
    },
}


class RBACGuard:
    """Enforces Platform-level and Workspace-level RBAC and Tenant Resource Ownership."""

    @staticmethod
    def require_permission(ctx: AuthenticatedContext, permission: str) -> None:
        allowed = WORKSPACE_ROLE_PERMISSIONS.get(ctx.workspace_role.upper(), set())
        if permission not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Workspace role '{ctx.workspace_role}' lacks required permission '{permission}'.",
            )

    @staticmethod
    def require_platform_admin(ctx: AuthenticatedContext) -> None:
        if ctx.platform_role not in ("PLATFORM_ADMIN", "PLATFORM_OPERATOR"):
            raise HTTPException(
                status_code=403,
                detail="Platform Administrator or Operator privileges are required for this endpoint.",
            )

    @staticmethod
    async def verify_resource_ownership(
        session: AsyncSession,
        ctx: AuthenticatedContext,
        resource: Any,
        resource_type: str,
        resource_id: str,
    ) -> None:
        if resource is None:
            raise HTTPException(status_code=404, detail=f"{resource_type} not found.")

        res_ws_id: Optional[str] = getattr(resource, "workspace_id", None)
        res_user_id: Optional[str] = getattr(resource, "user_id", None) or getattr(resource, "owner_user_id", None)

        # Legacy default workforce before workspace backfill belongs to ws_forge_default / usr_director
        if res_ws_id is None and res_user_id in (None, "usr_director") and ctx.user_id == "usr_director":
            return

        if res_ws_id and res_ws_id != ctx.workspace_id:
            await AuthService.record_audit(
                session=session,
                tenant_id=ctx.tenant_id,
                user_id=ctx.user_id,
                workspace_id=ctx.workspace_id,
                actor_type="USER",
                actor_id=ctx.user_id,
                action=f"CROSS_TENANT_ACCESS_BLOCKED_{resource_type.upper()}",
                resource_type=resource_type,
                resource_id=resource_id,
                status="DENIED",
                details={"target_workspace_id": res_ws_id},
            )
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: {resource_type} '{resource_id}' belongs to another isolated workspace.",
            )

        if not res_ws_id and res_user_id and res_user_id != ctx.user_id:
            await AuthService.record_audit(
                session=session,
                tenant_id=ctx.tenant_id,
                user_id=ctx.user_id,
                workspace_id=ctx.workspace_id,
                actor_type="USER",
                actor_id=ctx.user_id,
                action=f"CROSS_USER_ACCESS_BLOCKED_{resource_type.upper()}",
                resource_type=resource_type,
                resource_id=resource_id,
                status="DENIED",
                details={"target_user_id": res_user_id},
            )
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: {resource_type} '{resource_id}' belongs to another user.",
            )
