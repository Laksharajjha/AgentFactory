import asyncio
from pathlib import Path
import sys
import uuid

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import httpx
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from sqlalchemy import select, text

from app.config import UNSAFE_SECRET_DEFAULTS, Settings, settings
from app.database import (
    AsyncSessionLocal,
    apply_rls_context,
    clear_rls_context,
    engine,
    init_db,
    privileged_rls_context,
    reset_current_rls_state,
)
from app.events.event_bus import event_bus
from app.main import app
from app.models import (
    AgentEventModel,
    AgentModel,
    ArtifactModel,
    AuditLogModel,
    ExecutionModel,
    TaskModel,
    WorkforceModel,
    WorkspaceMemberModel,
)


async def run_phase1_security_lockdown_suite() -> None:
    await init_db()
    suffix = uuid.uuid4().hex[:8]
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # =====================================================================
        # TEST 1 — ANONYMOUS REQUESTS TO PROTECTED ENDPOINTS FAIL WITH 401
        # =====================================================================
        protected_get_endpoints = [
            "/api/auth/me",
            "/api/workspaces",
            "/api/settings/llm",
            "/api/artifacts",
            "/api/github/repositories",
            "/api/workforces/wf_forge_default",
            "/api/world/snapshot",
            "/api/tools",
            "/api/executions",
            "/api/queue",
            "/api/audit-logs",
            "/api/agents",
            "/api/tasks",
            "/api/meetings",
            "/api/usage",
            "/api/events",
        ]
        for ep in protected_get_endpoints:
            r_no_hdr = await client.get(ep)
            assert r_no_hdr.status_code == 401, f"Expected 401 on anonymous GET {ep}, got {r_no_hdr.status_code}"
            # Verify X-Require-Auth header cannot bypass authentication when set to 0 or omitted
            r_bypass_hdr = await client.get(ep, headers={"X-Require-Auth": "0"})
            assert r_bypass_hdr.status_code == 401, f"X-Require-Auth=0 must never bypass auth on {ep}"

        r_bad_jwt = await client.get(
            "/api/world/snapshot",
            headers={"Authorization": "Bearer forged.invalid.token"},
        )
        assert r_bad_jwt.status_code == 401
        print("[PASS] TEST 1 — Anonymous & forged-token requests to all protected endpoints fail with 401.")

        # =====================================================================
        # TEST 2 — ANONYMOUS REQUESTS CANNOT OBTAIN PLATFORM_ADMIN PRIVILEGES
        # =====================================================================
        anon_cap = await client.get("/api/admin/capacity")
        assert anon_cap.status_code == 401
        anon_gov = await client.post("/api/admin/governor", json={"max_concurrent_workforces": 5})
        assert anon_gov.status_code == 401

        # Provision Tenant A (Alice) and Tenant B (Bob)
        reg_a = await client.post(
            "/api/auth/register",
            json={
                "name": "Alice Security",
                "email": f"alice.sec.{suffix}@forge.dev",
                "password": "StrongPassword!123",
                "role_title": "Security Architect",
            },
        )
        assert reg_a.status_code == 200, reg_a.text
        data_a = reg_a.json()
        token_a = data_a["access_token"]
        user_a_id = data_a["user"]["id"]
        ws_a_id = data_a["workspace"]["id"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        reg_b = await client.post(
            "/api/auth/register",
            json={
                "name": "Bob Tenant",
                "email": f"bob.sec.{suffix}@forge.dev",
                "password": "StrongPassword!456",
                "role_title": "Systems Engineer",
            },
        )
        assert reg_b.status_code == 200, reg_b.text
        data_b = reg_b.json()
        token_b = data_b["access_token"]
        user_b_id = data_b["user"]["id"]
        ws_b_id = data_b["workspace"]["id"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # Standard authenticated user cannot access PLATFORM_ADMIN endpoints
        user_cap = await client.get("/api/admin/capacity", headers=headers_a)
        assert user_cap.status_code == 403
        user_gov = await client.post(
            "/api/admin/governor",
            headers=headers_a,
            json={"max_concurrent_workforces": 5},
        )
        assert user_gov.status_code == 403
        print("[PASS] TEST 2 — Anonymous & standard users cannot obtain PLATFORM_ADMIN privileges (401/403).")

        # =====================================================================
        # TEST 3 — INVALID / UNVERIFIED OAUTH REQUESTS ARE REJECTED
        # =====================================================================
        spoof_oauth = await client.post(
            "/api/auth/oauth",
            json={
                "provider": "google",
                "email": f"alice.sec.{suffix}@forge.dev",
                "name": "Spoofed Attacker",
            },
        )
        assert spoof_oauth.status_code == 403, f"Expected 403 on unverified OAuth, got {spoof_oauth.status_code}"
        assert "access_token" not in spoof_oauth.json()
        print("[PASS] TEST 3 — Unverified POST /api/auth/oauth requests are rejected with 403 (no token issued).")

        # =====================================================================
        # TEST 4 — UNAUTHORIZED LLM SETTINGS UPDATES FAIL; KEYS NEVER EXPOSED
        # =====================================================================
        anon_llm = await client.post("/api/settings/llm", json={"gemini_model": "gemini-2.5-flash"})
        assert anon_llm.status_code == 401

        # Create a non-admin MEMBER user in Workspace A and verify 403 on POST /api/settings/llm
        reg_member = await client.post(
            "/api/auth/register",
            json={
                "name": "Charlie Viewer",
                "email": f"charlie.sec.{suffix}@forge.dev",
                "password": "StrongPassword!789",
                "role_title": "Junior Analyst",
            },
        )
        assert reg_member.status_code == 200
        member_data = reg_member.json()
        member_user_id = member_data["user"]["id"]
        member_ws_id = member_data["workspace"]["id"]
        member_headers = {"Authorization": f"Bearer {member_data['access_token']}"}

        # Downgrade Charlie's role in his workspace to MEMBER to test RBAC enforcement
        async with AsyncSessionLocal() as session:
            async with privileged_rls_context(session):
                mem_row = (
                    await session.execute(
                        select(WorkspaceMemberModel).where(
                            WorkspaceMemberModel.user_id == member_user_id,
                            WorkspaceMemberModel.workspace_id == member_ws_id,
                        )
                    )
                ).scalar_one()
                mem_row.role = "MEMBER"
                await session.commit()

        member_llm = await client.post(
            "/api/settings/llm",
            headers=member_headers,
            json={"gemini_model": "gemini-2.5-flash"},
        )
        assert member_llm.status_code == 403, f"Expected 403 for MEMBER on LLM settings, got {member_llm.status_code}"

        # Invalid model name rejected with 422
        bad_model_llm = await client.post(
            "/api/settings/llm",
            headers=headers_a,
            json={"gemini_model": "invalid-malicious-model-v99"},
        )
        assert bad_model_llm.status_code == 422

        # Authorized OWNER update succeeds, never returns API key, and records audit log
        valid_llm = await client.post(
            "/api/settings/llm",
            headers=headers_a,
            json={"gemini_model": "gemini-2.5-flash", "enable_complex_model": True},
        )
        assert valid_llm.status_code == 200, valid_llm.text
        llm_body = valid_llm.json()
        assert "gemini_api_key" not in llm_body
        assert "api_key" not in llm_body

        get_llm = await client.get("/api/settings/llm", headers=headers_a)
        assert get_llm.status_code == 200
        assert "gemini_api_key" not in get_llm.json()

        audit_resp = await client.get("/api/audit-logs", headers=headers_a)
        assert audit_resp.status_code == 200
        audit_actions = [a["action"] for a in audit_resp.json()]
        assert "LLM_SETTINGS_UPDATED" in audit_actions
        print("[PASS] TEST 4 — LLM settings protected by auth + OWNER/ADMIN RBAC + model allowlist + audit log.")

        # =====================================================================
        # TEST 5 — UNAUTHORIZED WEBSOCKET CONNECTIONS FAIL; EVENTS TENANT-SCOPED
        # =====================================================================
        snap_a = (await client.get("/api/world/snapshot", headers=headers_a)).json()
        wf_a_id = snap_a["workforce_id"]
        snap_b = (await client.get("/api/world/snapshot", headers=headers_b)).json()
        wf_b_id = snap_b["workforce_id"]

        # Dispose asyncpg pool before entering sync TestClient's separate anyio thread loop
        await engine.dispose()
        with TestClient(app) as sync_client:
            # 5a. Anonymous WebSocket rejected
            try:
                with sync_client.websocket_connect(f"/ws/world/{wf_a_id}") as ws:
                    ws.receive_json()
                    raise AssertionError("Anonymous WebSocket should have been rejected")
            except WebSocketDisconnect as exc:
                assert exc.code == 1008

            # 5b. Invalid token WebSocket rejected
            try:
                with sync_client.websocket_connect(f"/ws/world/{wf_a_id}?token=invalid.jwt.token") as ws:
                    ws.receive_json()
                    raise AssertionError("Invalid token WebSocket should have been rejected")
            except WebSocketDisconnect as exc:
                assert exc.code == 1008

            # 5c. Global wildcard 'all' WebSocket rejected
            try:
                with sync_client.websocket_connect(f"/ws/world/all?token={token_a}") as ws:
                    ws.receive_json()
                    raise AssertionError("Wildcard 'all' WebSocket should have been rejected")
            except WebSocketDisconnect as exc:
                assert exc.code == 1008

            # 5d. Cross-tenant WebSocket rejected (User B attempting to subscribe to User A's workforce)
            try:
                with sync_client.websocket_connect(f"/ws/world/{wf_a_id}?token={token_b}") as ws:
                    ws.receive_json()
                    raise AssertionError("Cross-tenant WebSocket should have been rejected")
            except WebSocketDisconnect as exc:
                assert exc.code == 1008

            # 5e. Authorized WebSocket connection succeeds for owner User A
            with sync_client.websocket_connect(f"/ws/world/{wf_a_id}?token={token_a}") as ws_a_conn:
                init_msg = ws_a_conn.receive_json()
                assert init_msg["type"] == "INITIAL_SNAPSHOT"
                assert init_msg["snapshot"]["workspace_id"] == ws_a_id
                assert init_msg["snapshot"]["workforce_id"] == wf_a_id
            sync_client.portal.call(engine.dispose)

        print("[PASS] TEST 5 — Unauthorized & cross-tenant WebSockets rejected (1008); authorized WS scoped to tenant.")

        # =====================================================================
        # TEST 6 — CROSS-TENANT /api/events REQUESTS FAIL WITH 403
        # =====================================================================
        cross_events = await client.get(f"/api/events?workforce_id={wf_a_id}", headers=headers_b)
        assert cross_events.status_code == 403, f"Expected 403 on cross-tenant /api/events, got {cross_events.status_code}"

        own_events = await client.get(f"/api/events?workforce_id={wf_a_id}", headers=headers_a)
        assert own_events.status_code == 200
        assert all(ev["workforce_id"] == wf_a_id for ev in own_events.json())
        print("[PASS] TEST 6 — Cross-tenant /api/events rejected with 403; own events accessible.")

        # =====================================================================
        # TEST 7 — POSTGRESQL RLS BLOCKS CROSS-TENANT DB ACCESS AT ENGINE LAYER
        # =====================================================================
        # Create an artifact in Workspace A
        art_a_resp = await client.post(
            "/api/artifacts",
            headers=headers_a,
            json={"artifact_type": "PDF", "title": "Tenant A Confidential Dossier"},
        )
        assert art_a_resp.status_code == 200
        art_a_id = art_a_resp.json()["id"]

        async with AsyncSessionLocal() as session:
            async with privileged_rls_context(session):
                # Verify pg_class has relrowsecurity=true and relforcerowsecurity=true on all 36 tables
                rls_check = await session.execute(
                    text(
                        """
                        SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
                               COUNT(p.polname) AS policy_count
                        FROM pg_class c
                        JOIN pg_namespace n ON n.oid = c.relnamespace
                        LEFT JOIN pg_policy p ON p.polrelid = c.oid
                        WHERE n.nspname = 'public'
                          AND c.relkind = 'r'
                          AND c.relname NOT IN ('alembic_version', 'playing_with_neon')
                        GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
                        ORDER BY c.relname
                        """
                    )
                )
                rls_rows = list(rls_check.fetchall())
                assert len(rls_rows) == 36, f"Expected 36 RLS tables, found {len(rls_rows)}"
                for relname, rowsec, forcerowsec, pol_cnt in rls_rows:
                    assert rowsec is True, f"Table {relname} missing ENABLE ROW LEVEL SECURITY"
                    assert forcerowsec is True, f"Table {relname} missing FORCE ROW LEVEL SECURITY"
                    assert pol_cnt >= 4, f"Table {relname} expected 4 policies (SELECT/INSERT/UPDATE/DELETE), got {pol_cnt}"

            # Now switch session to Tenant B's RLS context and query Tenant A's rows directly via SQL
            await apply_rls_context(session, user_id=user_b_id, workspace_id=ws_b_id, platform_role="USER")

            role_row = (await session.execute(text("SELECT current_user"))).scalar_one()
            assert role_row == "forge_app_runtime", f"Expected active role forge_app_runtime, got {role_row}"

            leaked_wf = (
                await session.execute(select(WorkforceModel).where(WorkforceModel.id == wf_a_id))
            ).scalar_one_or_none()
            assert leaked_wf is None, "PostgreSQL RLS must hide Tenant A's workforce from Tenant B"

            leaked_art = (
                await session.execute(select(ArtifactModel).where(ArtifactModel.id == art_a_id))
            ).scalar_one_or_none()
            assert leaked_art is None, "PostgreSQL RLS must hide Tenant A's artifact from Tenant B"

            leaked_agents = list(
                (
                    await session.execute(select(AgentModel).where(AgentModel.workforce_id == wf_a_id))
                ).scalars().all()
            )
            assert len(leaked_agents) == 0, "PostgreSQL RLS must hide Tenant A's agents from Tenant B"

            leaked_events = list(
                (
                    await session.execute(select(AgentEventModel).where(AgentEventModel.workforce_id == wf_a_id))
                ).scalars().all()
            )
            assert len(leaked_events) == 0, "PostgreSQL RLS must hide Tenant A's events from Tenant B"

            # Attempt cross-tenant INSERT into Tenant A's workspace under Tenant B's RLS context -> must fail!
            rls_insert_blocked = False
            try:
                await session.execute(
                    text(
                        "INSERT INTO workforces (id, user_id, workspace_id, tenant_id, name, objective, status, "
                        "simulation_speed, is_paused, token_budget, tokens_used, llm_calls_made, max_llm_calls) "
                        "VALUES (:id, :uid, :wid, :tid, 'Spoof', 'Spoof', 'READY', 1.0, false, 1000, 0, 0, 10)"
                    ),
                    {
                        "id": f"wf_spoof_{suffix}",
                        "uid": user_b_id,
                        "wid": ws_a_id,  # Attempting to write into Tenant A's workspace!
                        "tid": f"ten_{user_b_id}",
                    },
                )
                await session.commit()
            except Exception as exc:
                rls_insert_blocked = "row-level security" in str(exc).lower()
                await session.rollback()
            assert rls_insert_blocked, "PostgreSQL RLS WITH CHECK policy must block cross-tenant INSERT!"

        print("[PASS] TEST 7 — PostgreSQL RLS (ENABLE + FORCE + 4 policies/table) blocks cross-tenant SELECT & INSERT.")

        # =====================================================================
        # TEST 8 — POOLED DB CONNECTIONS DO NOT RETAIN PRIOR TENANT CONTEXT
        # =====================================================================
        # Step 8a: Verify mid-session commit preserves RLS context across subsequent transactions in the same request
        async with AsyncSessionLocal() as session:
            await apply_rls_context(session, user_id=user_a_id, workspace_id=ws_a_id, platform_role="USER")
            own_wf_1 = (
                await session.execute(select(WorkforceModel).where(WorkforceModel.id == wf_a_id))
            ).scalar_one_or_none()
            assert own_wf_1 is not None
            await session.commit()  # Ends transaction 1

            # Transaction 2 on the same session must automatically re-bind RLS context via 'begin' listener
            own_wf_2 = (
                await session.execute(select(WorkforceModel).where(WorkforceModel.id == wf_a_id))
            ).scalar_one_or_none()
            assert own_wf_2 is not None, "Transaction begin listener must preserve RLS context across mid-request commits"
            await clear_rls_context(session)

        # Step 8b: Verify a fresh session checking out the pooled connection has clean/empty RLS context
        reset_current_rls_state()
        async with AsyncSessionLocal() as fresh_session:
            ws_setting = (
                await fresh_session.execute(text("SELECT current_setting('app.current_workspace_id', true)"))
            ).scalar_one()
            bypass_setting = (
                await fresh_session.execute(text("SELECT current_setting('app.bypass_rls', true)"))
            ).scalar_one()
            assert ws_setting == "", f"Pooled connection leaked workspace_id={ws_setting!r}"
            assert bypass_setting == "false", f"Pooled connection leaked bypass_rls={bypass_setting!r}"

            anon_rows = list((await fresh_session.execute(select(WorkforceModel))).scalars().all())
            assert len(anon_rows) == 0, "Unauthenticated pooled connection must see 0 tenant workforces under RLS"

        print("[PASS] TEST 8 — Pooled DB connections never leak prior tenant context & mid-request commits preserve context.")

        # =====================================================================
        # TEST 9 — VALID AUTHENTICATED USERS CAN ACCESS THEIR OWN WORKSPACES
        # =====================================================================
        my_arts_a = await client.get("/api/artifacts", headers=headers_a)
        assert my_arts_a.status_code == 200
        assert any(a["id"] == art_a_id for a in my_arts_a.json())

        my_agents_a = await client.get("/api/agents", headers=headers_a)
        assert my_agents_a.status_code == 200
        assert len(my_agents_a.json()) == 6

        my_ws_b = await client.get("/api/workspaces", headers=headers_b)
        assert my_ws_b.status_code == 200
        assert len(my_ws_b.json()) == 1
        assert my_ws_b.json()[0]["id"] == ws_b_id
        print("[PASS] TEST 9 — Valid authenticated users can access all resources in their own workspaces.")

        # =====================================================================
        # TEST 10 — CORS & SECRETS VALIDATION ENFORCED
        # =====================================================================
        assert "*" not in settings.allowed_cors_origins
        for unsafe_val in UNSAFE_SECRET_DEFAULTS:
            assert settings.AUTH_SECRET_KEY != unsafe_val
            assert settings.CREDENTIAL_ENCRYPTION_KEY != unsafe_val
        assert len(settings.AUTH_SECRET_KEY) >= 32
        assert len(settings.CREDENTIAL_ENCRYPTION_KEY) >= 32
        print("[PASS] TEST 10 — Explicit CORS origins & cryptographic secret validation enforced.")


if __name__ == "__main__":
    asyncio.run(run_phase1_security_lockdown_suite())
