import asyncio
from pathlib import Path
import sys
import uuid

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import httpx  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.auth.auth_service import AuthService  # noqa: E402
from app.database import AsyncSessionLocal, init_db, privileged_rls_context  # noqa: E402
from app.main import app  # noqa: E402
from app.models import UserModel  # noqa: E402


async def _issue_token_for_role(email: str, platform_role: str) -> str:
    async with AsyncSessionLocal() as session:
        async with privileged_rls_context(session):
            user = UserModel(
                id=f"usr_{uuid.uuid4().hex[:10]}",
                name=f"Test {platform_role}",
                email=email,
                password_hash="not-used-direct-session",
                role=platform_role,
                platform_role=platform_role,
                email_verified=True,
                auth_provider="local",
                is_active=True,
            )
            session.add(user)
            await session.flush()
            ws, _ = await AuthService.ensure_personal_workspace_for_user(session, user)
            token_data = await AuthService.issue_session(session, user, ws)
            await session.commit()
            return token_data["access_token"]


async def run_platform_admin_isolation_suite() -> None:
    await init_db()
    user_token = await _issue_token_for_role(
        f"iso_user_{uuid.uuid4().hex[:8]}@forge.dev", "USER"
    )
    admin_token = await _issue_token_for_role(
        f"iso_admin_{uuid.uuid4().hex[:8]}@forge.dev", "PLATFORM_ADMIN"
    )
    operator_token = await _issue_token_for_role(
        f"iso_op_{uuid.uuid4().hex[:8]}@forge.dev", "PLATFORM_OPERATOR"
    )

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        # 1. Anonymous user cannot retrieve global capacity metrics
        health = await client.get("/api/health")
        assert health.status_code == 200, health.text
        assert "capacity" not in health.json(), "/api/health must not expose global capacity"
        assert (await client.get("/api/world/snapshot")).status_code == 401
        assert (await client.get("/api/queue")).status_code == 401
        assert (await client.get("/api/admin/capacity")).status_code == 401
        assert (await client.post("/api/admin/governor", json={})).status_code == 401
        print("[PASS] 1. Anonymous user cannot retrieve global capacity metrics.")

        # 2, 3, 4. Ordinary USER gets normal snapshot & workspace queue without global capacity
        u_headers = {"Authorization": f"Bearer {user_token}"}
        u_snap = await client.get("/api/world/snapshot", headers=u_headers)
        assert u_snap.status_code == 200, u_snap.text
        u_snap_json = u_snap.json()
        assert u_snap_json.get("system_capacity") is None, "USER snapshot must not include global system_capacity"
        assert u_snap_json.get("workforce_id"), "USER must still receive normal workforce snapshot"
        assert isinstance(u_snap_json.get("agents"), list)

        u_queue = await client.get("/api/queue", headers=u_headers)
        assert u_queue.status_code == 200, u_queue.text
        u_queue_json = u_queue.json()
        assert u_queue_json.get("capacity") is None, "USER /api/queue must not include global capacity"
        assert "workspace_queue_summary" in u_queue_json
        assert isinstance(u_queue_json.get("queue_items"), list)

        assert (await client.get("/api/admin/capacity", headers=u_headers)).status_code == 403
        assert (await client.post("/api/admin/governor", headers=u_headers, json={})).status_code == 403
        print("[PASS] 2,3,4. Ordinary USER gets normal snapshot & queue with zero global telemetry leakage; admin endpoints 403.")

        # 5. PLATFORM_ADMIN can retrieve authorized global capacity metrics
        a_headers = {"Authorization": f"Bearer {admin_token}"}
        a_snap = await client.get("/api/world/snapshot", headers=a_headers)
        assert a_snap.status_code == 200 and a_snap.json().get("system_capacity") is not None
        a_queue = await client.get("/api/queue", headers=a_headers)
        assert a_queue.status_code == 200 and a_queue.json().get("capacity") is not None
        a_cap = await client.get("/api/admin/capacity", headers=a_headers)
        assert a_cap.status_code == 200 and "capacity" in a_cap.json()
        print("[PASS] 5. PLATFORM_ADMIN can retrieve authorized global capacity metrics.")

        # 6. PLATFORM_OPERATOR can retrieve authorized global capacity metrics
        o_headers = {"Authorization": f"Bearer {operator_token}"}
        o_snap = await client.get("/api/world/snapshot", headers=o_headers)
        assert o_snap.status_code == 200 and o_snap.json().get("system_capacity") is not None
        o_queue = await client.get("/api/queue", headers=o_headers)
        assert o_queue.status_code == 200 and o_queue.json().get("capacity") is not None
        o_cap = await client.get("/api/admin/capacity", headers=o_headers)
        assert o_cap.status_code == 200 and "capacity" in o_cap.json()
        print("[PASS] 6. PLATFORM_OPERATOR can retrieve authorized global capacity metrics.")


if __name__ == "__main__":
    asyncio.run(run_platform_admin_isolation_suite())
