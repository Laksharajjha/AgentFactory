import asyncio
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import httpx
from fastapi import HTTPException
from sqlalchemy import select

from app.auth.auth_service import create_jwt_token
from app.database import AsyncSessionLocal, apply_rls_context, privileged_rls_context
from app.integrations.github_service import GitHubService
from app.main import app
from app.models import (
    ConnectedRepositoryModel,
    GitHubInstallationModel,
    IntegrationCredentialModel,
    SessionModel,
    WorkspaceMemberModel,
)


async def run_tests() -> None:
    async with AsyncSessionLocal() as s:
        async with privileged_rls_context():
            admin_ses = (
                await s.execute(
                    select(SessionModel.id).where(
                        SessionModel.user_id == "usr_0bae661227",
                        SessionModel.is_revoked == False,  # noqa: E712
                    )
                )
            ).scalars().first()
            ilena_ses = (
                await s.execute(
                    select(SessionModel.id).where(
                        SessionModel.user_id == "usr_5797bbbf97",
                        SessionModel.is_revoked == False,  # noqa: E712
                    )
                )
            ).scalars().first()
            third_ses = (
                await s.execute(
                    select(SessionModel.id).where(
                        SessionModel.user_id == "usr_87f7782716",
                        SessionModel.is_revoked == False,  # noqa: E712
                    )
                )
            ).scalars().first()
            third_ws = (
                await s.execute(
                    select(WorkspaceMemberModel.workspace_id).where(
                        WorkspaceMemberModel.user_id == "usr_87f7782716"
                    )
                )
            ).scalar_one()

    assert admin_ses and ilena_ses and third_ses, "Required test sessions missing"

    admin_tok, _ = create_jwt_token("usr_0bae661227", "ws_32e17d372e", admin_ses, "PLATFORM_ADMIN")
    ilena_tok, _ = create_jwt_token("usr_5797bbbf97", "ws_2e6167af60", ilena_ses, "USER")
    third_tok, _ = create_jwt_token("usr_87f7782716", third_ws, third_ses, "USER")

    admin_h = {"Authorization": f"Bearer {admin_tok}", "X-Workspace-Id": "ws_32e17d372e"}
    ilena_h = {"Authorization": f"Bearer {ilena_tok}", "X-Workspace-Id": "ws_2e6167af60"}
    third_h = {"Authorization": f"Bearer {third_tok}", "X-Workspace-Id": third_ws}

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver", timeout=20.0) as client:
        # 1. Original user can access legitimate installation & repositories
        r1 = await client.get("/api/github/status", headers=admin_h)
        assert r1.status_code == 200, r1.text
        assert r1.json()["status"] == "CONNECTED"
        assert r1.json()["installation"]["installation_id"] == "181968090"
        print("PASS [1/9]: Original user accesses legitimate installation 181968090")

        # 2. Ilena cannot access original workspace's credentials (API 403 + RLS 0 rows + Service 403)
        r2_api = await client.get(
            "/api/github/status",
            headers={"Authorization": f"Bearer {ilena_tok}", "X-Workspace-Id": "ws_32e17d372e"},
        )
        assert r2_api.status_code == 403, f"Expected 403, got {r2_api.status_code}"

        async with AsyncSessionLocal() as s_rls:
            await apply_rls_context(s_rls, "usr_5797bbbf97", "ws_2e6167af60", "USER")
            rls_creds = (
                await s_rls.execute(
                    select(IntegrationCredentialModel).where(
                        IntegrationCredentialModel.workspace_id == "ws_32e17d372e"
                    )
                )
            ).scalars().all()
            rls_insts = (
                await s_rls.execute(
                    select(GitHubInstallationModel).where(
                        GitHubInstallationModel.workspace_id == "ws_32e17d372e"
                    )
                )
            ).scalars().all()
            assert len(rls_creds) == 0 and len(rls_insts) == 0

            try:
                await GitHubService.get_installation_token(s_rls, "ws_32e17d372e", user_id="usr_5797bbbf97")
                raise AssertionError("Expected 403 from get_installation_token for non-member")
            except HTTPException as exc:
                assert exc.status_code == 403
        print("PASS [2/9]: Ilena blocked from ws_32e17d372e credentials via API (403), RLS (0 rows), and service (403)")

        # 3. Ilena cannot bind installation 181968090 via POST /api/github/connect (unverified path disabled)
        r3 = await client.post("/api/github/connect", headers=ilena_h, json={"account_login": "Laksharajjha"})
        assert r3.status_code == 403, f"Expected 403, got {r3.status_code}: {r3.text}"
        r3_id = await client.post("/api/github/connect", headers=ilena_h, json={"installation_id": "181968090"})
        assert r3_id.status_code == 403, f"Expected 403, got {r3_id.status_code}: {r3_id.text}"

        async with AsyncSessionLocal() as s_svc:
            async with privileged_rls_context():
                try:
                    await GitHubService.connect_github_app(
                        session=s_svc,
                        workspace_id="ws_2e6167af60",
                        user_id="usr_5797bbbf97",
                        installation_id="181968090",
                    )
                    raise AssertionError("Expected 403 from connect_github_app without github_user_token")
                except HTTPException as exc:
                    assert exc.status_code == 403
        print("PASS [3/9]: Unverified POST /api/github/connect and service binding blocked with 403")

        # 4. Ilena cannot list, sync PRs, or execute-branch against ws_32e17d372e's rep_f9bfa00665
        r4_sync = await client.post("/api/github/repositories/rep_f9bfa00665/pulls/sync", headers=ilena_h)
        assert r4_sync.status_code == 403, f"Expected 403, got {r4_sync.status_code}"
        r4_exec = await client.post(
            "/api/github/repositories/rep_f9bfa00665/execute-branch",
            headers=ilena_h,
            json={"execution_id": "exc_blocked", "branch_name": "forge/blocked"},
        )
        assert r4_exec.status_code == 403, f"Expected 403, got {r4_exec.status_code}"
        print("PASS [4/9]: Ilena blocked from ws_32e17d372e repository operations (403)")

        # 5. Third user cannot inherit either workspace's GitHub integration
        r5_status = await client.get("/api/github/status", headers=third_h)
        assert r5_status.status_code == 200
        assert r5_status.json()["status"] == "NOT_CONNECTED"
        assert r5_status.json()["repositories"] == []
        r5_connect = await client.post("/api/github/connect", headers=third_h, json={})
        assert r5_connect.status_code == 403
        print("PASS [5/9]: Third user has NOT_CONNECTED state, 0 repos, and cannot connect without OAuth (403)")

        # 6. Cross-workspace OAuth state binding enforced
        r6_start = await client.get(
            "/api/github/oauth/start?redirect_uri=http://127.0.0.1:5173/",
            headers=admin_h,
        )
        assert r6_start.status_code == 200, r6_start.text
        state = r6_start.json()["state"]
        assert "code_challenge=" in r6_start.json()["authorize_url"]
        r6_ex = await client.post(
            "/api/github/oauth/exchange",
            headers=ilena_h,
            json={"state": state, "code": "dummy_code"},
        )
        assert r6_ex.status_code == 403, f"Expected 403 for cross-user OAuth state, got {r6_ex.status_code}"
        print("PASS [6/9]: PKCE OAuth state rejects cross-user/cross-workspace replay (403)")

        # 7. Unauthenticated requests return 401
        assert (await client.get("/api/github/status")).status_code == 401
        assert (await client.post("/api/github/connect", json={})).status_code == 401
        assert (await client.get("/api/github/repositories")).status_code == 401
        print("PASS [7/9]: Unauthenticated GitHub endpoints return 401")

        # 8. Service-layer OWNER/ADMIN check blocks non-member/non-admin
        async with AsyncSessionLocal() as s_adm:
            async with privileged_rls_context():
                try:
                    await GitHubService._verify_workspace_admin(s_adm, "ws_32e17d372e", "usr_5797bbbf97")
                    raise AssertionError("Expected 403 for non-admin")
                except HTTPException as exc:
                    assert exc.status_code == 403
        print("PASS [8/9]: Service-layer _verify_workspace_admin blocks unauthorized users (403)")

        # 9. Existing ws_32e17d372e repositories & PR #1 preserved intact
        r9 = await client.get("/api/github/repositories", headers=admin_h)
        assert r9.status_code == 200
        names = [r["full_name"] for r in r9.json()]
        assert "Laksharajjha/IsoGrid" in names and "Laksharajjha/Moneo" in names
        print(f"PASS [9/9]: Original ws_32e17d372e repositories preserved ({names})")

    print("ALL 9 GITHUB MULTI-TENANT ISOLATION REGRESSION TESTS PASSED!")


if __name__ == "__main__":
    asyncio.run(run_tests())
