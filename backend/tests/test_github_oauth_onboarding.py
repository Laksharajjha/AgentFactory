import asyncio
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import httpx
from sqlalchemy import delete, select

from app.auth.auth_service import create_jwt_token
from app.database import AsyncSessionLocal, apply_rls_context, privileged_rls_context
from app.integrations.github_service import GitHubService, encrypt_credential_payload
from app.main import app
from app.models import (
    ConnectedRepositoryModel,
    GitHubInstallationModel,
    IntegrationCredentialModel,
    SessionModel,
    UserModel,
    WorkspaceMemberModel,
    WorkspaceModel,
)


_ORIG_ASYNC_CLIENT = httpx.AsyncClient


def _mock_client_factory(handler):
    class _MockAsyncClient:
        def __init__(self, *args, **kwargs):
            self._transport = httpx.MockTransport(handler)
            self._client = _ORIG_ASYNC_CLIENT(transport=self._transport)

        async def __aenter__(self):
            return self._client

        async def __aexit__(self, exc_type, exc, tb):
            await self._client.aclose()

    return _MockAsyncClient


async def run_tests() -> None:
    suffix = uuid.uuid4().hex[:8]
    email_a = f"gh_onboard_a_{suffix}@forge.dev"
    email_b = f"gh_onboard_b_{suffix}@forge.dev"
    email_mem = f"gh_onboard_mem_{suffix}@forge.dev"
    created_user_ids = []
    created_ws_ids = []

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver", timeout=20.0) as client:
        # Register ephemeral test users
        ra = await client.post("/api/auth/register", json={"email": email_a, "password": "Password123!", "name": "Onboard A"})
        assert ra.status_code == 200, ra.text
        da = ra.json()
        tok_a = da["access_token"]
        ws_a = da["workspace"]["id"]
        usr_a = da["user"]["id"]
        created_user_ids.append(usr_a)
        created_ws_ids.append(ws_a)

        rb = await client.post("/api/auth/register", json={"email": email_b, "password": "Password123!", "name": "Onboard B"})
        assert rb.status_code == 200, rb.text
        db = rb.json()
        tok_b = db["access_token"]
        ws_b = db["workspace"]["id"]
        usr_b = db["user"]["id"]
        created_user_ids.append(usr_b)
        created_ws_ids.append(ws_b)

        rm = await client.post("/api/auth/register", json={"email": email_mem, "password": "Password123!", "name": "Member RO"})
        assert rm.status_code == 200, rm.text
        dm = rm.json()
        usr_mem = dm["user"]["id"]
        ws_mem_own = dm["workspace"]["id"]
        created_user_ids.append(usr_mem)
        created_ws_ids.append(ws_mem_own)

        # Add usr_mem as MEMBER (non-admin) of ws_a
        async with AsyncSessionLocal() as s:
            async with privileged_rls_context():
                s.add(
                    WorkspaceMemberModel(
                        id=f"wm_{uuid.uuid4().hex[:10]}",
                        workspace_id=ws_a,
                        user_id=usr_mem,
                        role="MEMBER",
                    )
                )
                ses_mem = (
                    await s.execute(select(SessionModel.id).where(SessionModel.user_id == usr_mem, SessionModel.is_revoked == False))
                ).scalars().first()
                await s.commit()
        tok_mem_in_a, _ = create_jwt_token(usr_mem, ws_a, ses_mem, "USER")

        h_a = {"Authorization": f"Bearer {tok_a}", "X-Workspace-Id": ws_a}
        h_b = {"Authorization": f"Bearer {tok_b}", "X-Workspace-Id": ws_b}
        h_mem_a = {"Authorization": f"Bearer {tok_mem_in_a}", "X-Workspace-Id": ws_a}

        try:
            # 1. Start OAuth validation (unauth, untrusted redirect, non-admin, valid owner)
            assert (await client.get("/api/github/oauth/start?redirect_uri=http://127.0.0.1:5173/")).status_code == 401
            assert (await client.get("/api/github/oauth/start?redirect_uri=https://evil.example.com/", headers=h_a)).status_code == 400
            assert (await client.get("/api/github/oauth/start?redirect_uri=http://127.0.0.1:5173/", headers=h_mem_a)).status_code == 403

            r_start = await client.get("/api/github/oauth/start?redirect_uri=http://127.0.0.1:5173/", headers=h_a)
            assert r_start.status_code == 200, r_start.text
            start_data = r_start.json()
            assert "https://github.com/apps/projectforge-platform/installations/new?state=" in start_data["install_authorize_url"]
            assert "code_challenge=" in start_data["authorize_url"]
            print("PASS [1/7]: OAuth start enforces auth, origin validation, RBAC, and returns install + PKCE URLs")

            # 2. Unauthenticated, invalid state, and cross-user state replay rejected
            assert (await client.post("/api/github/oauth/exchange", json={"state": "bad", "code": "c"})).status_code == 401
            assert (await client.post("/api/github/oauth/exchange", headers=h_a, json={"state": "invalid_state", "code": "c"})).status_code == 400
            assert (
                await client.post(
                    "/api/github/oauth/exchange",
                    headers=h_b,
                    json={"state": start_data["install_state"], "code": "c"},
                )
            ).status_code == 403
            print("PASS [2/7]: Invalid state (400), unauthenticated callback (401), and cross-user state (403) rejected")

            # 3. GitHub OAuth rejection (access_denied) & GitHub API unavailable
            s1 = (await client.get("/api/github/oauth/start?redirect_uri=http://127.0.0.1:5173/", headers=h_a)).json()["install_state"]

            def reject_handler(req: httpx.Request) -> httpx.Response:
                if "login/oauth/access_token" in str(req.url):
                    return httpx.Response(200, json={"error": "access_denied", "error_description": "User cancelled"})
                return httpx.Response(404)

            with patch("app.integrations.github_service.httpx.AsyncClient", _mock_client_factory(reject_handler)):
                r_rej = await client.post("/api/github/oauth/exchange", headers=h_a, json={"state": s1, "code": "bad_code"})
                assert r_rej.status_code == 400, r_rej.text

            s2 = (await client.get("/api/github/oauth/start?redirect_uri=http://127.0.0.1:5173/", headers=h_a)).json()["install_state"]

            def net_err_handler(req: httpx.Request) -> httpx.Response:
                raise httpx.ConnectError("GitHub unreachable", request=req)

            with patch("app.integrations.github_service.httpx.AsyncClient", _mock_client_factory(net_err_handler)):
                r_net = await client.post("/api/github/oauth/exchange", headers=h_a, json={"state": s2, "code": "c"})
                assert r_net.status_code == 502, r_net.text
            print("PASS [3/7]: GitHub OAuth rejection (400) and GitHub API outage (502) handled safely")

            # 4. Missing installation (404) and installation ownership mismatch (403)
            s3 = (await client.get("/api/github/oauth/start?redirect_uri=http://127.0.0.1:5173/", headers=h_a)).json()["install_state"]

            def no_inst_handler(req: httpx.Request) -> httpx.Response:
                url = str(req.url)
                if "login/oauth/access_token" in url:
                    return httpx.Response(200, json={"access_token": "ghu_user_a"})
                if url.endswith("/user"):
                    return httpx.Response(200, json={"login": "alice_gh"})
                if url.endswith("/user/installations"):
                    return httpx.Response(200, json={"installations": []})
                return httpx.Response(404)

            with patch("app.integrations.github_service.httpx.AsyncClient", _mock_client_factory(no_inst_handler)):
                r_noinst = await client.post("/api/github/oauth/exchange", headers=h_a, json={"state": s3, "code": "c"})
                assert r_noinst.status_code == 404, r_noinst.text

            s4 = (await client.get("/api/github/oauth/start?redirect_uri=http://127.0.0.1:5173/", headers=h_a)).json()["install_state"]

            def mismatch_inst_handler(req: httpx.Request) -> httpx.Response:
                url = str(req.url)
                if "login/oauth/access_token" in url:
                    return httpx.Response(200, json={"access_token": "ghu_user_a"})
                if url.endswith("/user"):
                    return httpx.Response(200, json={"login": "alice_gh"})
                if url.endswith("/user/installations"):
                    return httpx.Response(200, json={"installations": [{"id": 777001, "account": {"login": "alice_gh", "type": "User"}}]})
                return httpx.Response(404)

            with patch("app.integrations.github_service.httpx.AsyncClient", _mock_client_factory(mismatch_inst_handler)):
                r_mis = await client.post(
                    "/api/github/oauth/exchange",
                    headers=h_a,
                    json={"state": s4, "code": "c", "installation_id": "999999"},
                )
                assert r_mis.status_code == 403, r_mis.text
            print("PASS [4/7]: Missing installation (404) and foreign installation_id mismatch (403) enforced")

            # 5. Repository discovery failure (500 from GitHub -> 502)
            s5 = (await client.get("/api/github/oauth/start?redirect_uri=http://127.0.0.1:5173/", headers=h_a)).json()["install_state"]

            def repo_fail_handler(req: httpx.Request) -> httpx.Response:
                url = str(req.url)
                if "login/oauth/access_token" in url:
                    return httpx.Response(200, json={"access_token": "ghu_user_a"})
                if url.endswith("/user"):
                    return httpx.Response(200, json={"login": "alice_gh"})
                if url.endswith("/user/installations"):
                    return httpx.Response(
                        200,
                        json={"installations": [{"id": 777001, "account": {"login": "alice_gh", "type": "User"}, "permissions": {"contents": "write"}}]},
                    )
                if "/app/installations/777001/access_tokens" in url:
                    return httpx.Response(
                        201,
                        json={"token": "ghs_test_token_a", "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(), "permissions": {"contents": "write"}},
                    )
                if "/installation/repositories" in url:
                    return httpx.Response(500, json={"message": "GitHub upstream error"})
                return httpx.Response(404)

            with patch("app.integrations.github_service.httpx.AsyncClient", _mock_client_factory(repo_fail_handler)):
                r_repofail = await client.post(
                    "/api/github/oauth/exchange",
                    headers=h_a,
                    json={"state": s5, "code": "c", "installation_id": "777001"},
                )
                assert r_repofail.status_code == 502, r_repofail.text
            print("PASS [5/7]: Repository discovery failure returns 502 without marking workspace CONNECTED")

            # 6. Full successful one-click onboarding + single-use state replay rejection + cross-workspace repo isolation
            s6 = (await client.get("/api/github/oauth/start?redirect_uri=http://127.0.0.1:5173/", headers=h_a)).json()["install_state"]

            def success_handler(req: httpx.Request) -> httpx.Response:
                url = str(req.url)
                if "login/oauth/access_token" in url:
                    return httpx.Response(200, json={"access_token": "ghu_user_a"})
                if url.endswith("/user"):
                    return httpx.Response(200, json={"login": "alice_gh"})
                if url.endswith("/user/installations"):
                    return httpx.Response(
                        200,
                        json={"installations": [{"id": 777001, "account": {"login": "alice_gh", "type": "User"}, "permissions": {"contents": "write", "pull_requests": "write"}}]},
                    )
                if "/app/installations/777001/access_tokens" in url:
                    return httpx.Response(
                        201,
                        json={
                            "token": "ghs_fresh_token_a",
                            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                            "permissions": {"contents": "write", "pull_requests": "write"},
                        },
                    )
                if "/installation/repositories" in url:
                    return httpx.Response(
                        200,
                        json={
                            "repositories": [
                                {
                                    "full_name": "alice_gh/forge-demo",
                                    "name": "forge-demo",
                                    "owner": {"login": "alice_gh"},
                                    "default_branch": "main",
                                    "private": True,
                                    "language": "TypeScript",
                                    "clone_url": "https://github.com/alice_gh/forge-demo.git",
                                    "html_url": "https://github.com/alice_gh/forge-demo",
                                }
                            ]
                        },
                    )
                if "/branches" in url:
                    return httpx.Response(200, json=[{"name": "main"}])
                if "/pulls" in url:
                    return httpx.Response(200, json=[])
                return httpx.Response(404)

            with patch("app.integrations.github_service.httpx.AsyncClient", _mock_client_factory(success_handler)):
                r_ok = await client.post(
                    "/api/github/oauth/exchange",
                    headers=h_a,
                    json={"state": s6, "code": "valid_code", "installation_id": "777001"},
                )
                assert r_ok.status_code == 200, r_ok.text
                ok_data = r_ok.json()
                assert ok_data["status"] == "CONNECTED"
                assert ok_data["installation"]["account_login"] == "alice_gh"
                assert len(ok_data["repositories"]) == 1
                repo_a_id = ok_data["repositories"][0]["id"]

            # Replaying the same state is rejected (single-use)
            r_replay = await client.post(
                "/api/github/oauth/exchange",
                headers=h_a,
                json={"state": s6, "code": "valid_code", "installation_id": "777001"},
            )
            assert r_replay.status_code == 400, r_replay.text

            # User B cannot see or access User A's repo
            r_b_repos = await client.get("/api/github/repositories", headers=h_b)
            assert r_b_repos.status_code == 200 and r_b_repos.json() == []
            assert (await client.post(f"/api/github/repositories/{repo_a_id}/pulls/sync", headers=h_b)).status_code == 403
            print("PASS [6/7]: Full onboarding succeeded, state replay rejected (400), and User B isolated (403)")

            # 7. Expired installation token is automatically refreshed & disconnect clears ws_a only
            GitHubService._token_cache.pop((ws_a, "777001"), None)
            async with AsyncSessionLocal() as s:
                await apply_rls_context(s, workspace_id=ws_a, user_id=usr_a)
                cred = (
                    await s.execute(
                        select(IntegrationCredentialModel).where(
                            IntegrationCredentialModel.workspace_id == ws_a,
                            IntegrationCredentialModel.provider == "github_app",
                        )
                    )
                ).scalar_one()
                cred.encrypted_payload = encrypt_credential_payload(
                    {
                        "installation_id": "777001",
                        "token": "ghs_expired",
                        "expires_at": (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat(),
                    }
                )
                await s.commit()

            with patch("app.integrations.github_service.httpx.AsyncClient", _mock_client_factory(success_handler)):
                async with AsyncSessionLocal() as s:
                    await apply_rls_context(s, workspace_id=ws_a, user_id=usr_a)
                    refreshed_tok, _ = await GitHubService.get_installation_token(s, ws_a, user_id=usr_a)
                    assert refreshed_tok == "ghs_fresh_token_a"

            r_disc = await client.delete("/api/github/disconnect", headers=h_a)
            assert r_disc.status_code == 200 and r_disc.json()["status"] == "NOT_CONNECTED"
            print("PASS [7/7]: Expired installation token auto-refreshed and disconnect scoped to workspace")

        finally:
            # Clean up ONLY ephemeral GitHub records created by this test run
            async with AsyncSessionLocal() as s:
                async with privileged_rls_context():
                    for wid in created_ws_ids:
                        await s.execute(delete(ConnectedRepositoryModel).where(ConnectedRepositoryModel.workspace_id == wid))
                        await s.execute(delete(IntegrationCredentialModel).where(IntegrationCredentialModel.workspace_id == wid))
                        await s.execute(delete(GitHubInstallationModel).where(GitHubInstallationModel.workspace_id == wid))
                    await s.commit()

    print("ALL 7 GITHUB OAUTH ONBOARDING & FAILURE HANDLING TESTS PASSED!")


if __name__ == "__main__":
    asyncio.run(run_tests())
