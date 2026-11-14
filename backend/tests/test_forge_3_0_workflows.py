import asyncio
import io
from pathlib import Path
import sys
import uuid
import zipfile
from datetime import datetime, timedelta, timezone

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import httpx
from sqlalchemy import select

from app.database import AsyncSessionLocal, init_db, privileged_rls_context
from app.main import app
from app.models import ExecutionLeaseModel, ExecutionModel
from app.scheduler.execution_lease import ExecutionLeaseManager


async def run_all_acceptance_workflows() -> None:
    await init_db()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        suffix = uuid.uuid4().hex[:6]

        # =====================================================================
        # WORKFLOW A — AUTHENTICATION & PERSONAL WORKSPACE PROVISIONING
        # =====================================================================
        reg_a = await client.post(
            "/api/auth/register",
            json={
                "name": "Alice Architect",
                "email": f"alice.{suffix}@forge.dev",
                "password": "StrongPassword!123",
                "role_title": "Principal Architect",
            },
        )
        assert reg_a.status_code == 200, reg_a.text
        data_a = reg_a.json()
        token_a = data_a["access_token"]
        ws_a = data_a["workspace"]["id"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        reg_b = await client.post(
            "/api/auth/register",
            json={
                "name": "Bob Security",
                "email": f"bob.{suffix}@forge.dev",
                "password": "StrongPassword!456",
                "role_title": "Security Lead",
            },
        )
        assert reg_b.status_code == 200, reg_b.text
        data_b = reg_b.json()
        token_b = data_b["access_token"]
        ws_b = data_b["workspace"]["id"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        assert ws_a != ws_b, "Each user must receive an isolated personal workspace"

        me_a = await client.get("/api/auth/me", headers=headers_a)
        assert me_a.status_code == 200
        assert me_a.json()["active_workspace"]["id"] == ws_a
        print("[PASS] WORKFLOW A — Authentication & isolated workspace provisioning verified.")

        # =====================================================================
        # WORKFLOW B — UNIVERSAL ARTIFACT GENERATION (PPTX, PDF, XLSX, DOCX)
        # =====================================================================
        pptx_resp = await client.post(
            "/api/artifacts",
            headers=headers_a,
            json={
                "artifact_type": "PPTX",
                "title": "Zero-Trust Service Architecture Briefing",
                "structured_content": {
                    "subtitle": "Q4 Autonomous Engineering Deliverable",
                    "slides": [
                        {
                            "title": "Architecture Overview",
                            "bullets": ["Hexagonal boundaries", "Neon PostgreSQL RLS"],
                        },
                        {
                            "title": "Security & Governance",
                            "bullets": ["Resource Governor active", "Signed artifact URLs"],
                        },
                    ],
                },
            },
        )
        assert pptx_resp.status_code == 200, pptx_resp.text
        pptx_meta = pptx_resp.json()
        assert pptx_meta["validation_status"] == "VALID"
        assert pptx_meta["file_size"] > 500

        # Download via signed URL and verify valid OOXML PPTX ZIP container
        dl_resp = await client.get(pptx_meta["download_url"])
        assert dl_resp.status_code == 200
        assert zipfile.is_zipfile(io.BytesIO(dl_resp.content))
        with zipfile.ZipFile(io.BytesIO(dl_resp.content), "r") as zf:
            assert "ppt/presentation.xml" in zf.namelist()
            assert "ppt/slides/slide1.xml" in zf.namelist()

        # Generate PDF & XLSX
        pdf_resp = await client.post(
            "/api/artifacts",
            headers=headers_a,
            json={"artifact_type": "PDF", "title": "Executive Audit Report"},
        )
        assert pdf_resp.status_code == 200
        pdf_dl = await client.get(pdf_resp.json()["download_url"])
        assert pdf_dl.content.startswith(b"%PDF-1.4")

        xlsx_resp = await client.post(
            "/api/artifacts",
            headers=headers_a,
            json={"artifact_type": "XLSX", "title": "QA Regression Matrix"},
        )
        assert xlsx_resp.status_code == 200
        print("[PASS] WORKFLOW B — Valid PPTX, PDF, and XLSX generation & signed downloads verified.")

        # =====================================================================
        # WORKFLOW C — GITHUB APP, BRANCH SAFETY, SANDBOX TESTS, DIFF & PR APPROVAL
        # =====================================================================
        gh_conn = await client.post(
            "/api/github/connect",
            headers=headers_a,
            json={"account_login": "Laksharajjha"},
        )
        assert gh_conn.status_code == 200, gh_conn.text
        repo_id = gh_conn.json()["repositories"][0]["id"]

        # Verify pushing to default branch 'main' is rejected
        bad_branch = await client.post(
            f"/api/github/repositories/{repo_id}/execute-branch",
            headers=headers_a,
            json={
                "execution_id": f"exc_bad_{suffix}",
                "branch_name": "main",
                "file_path": "src/auth_middleware.py",
            },
        )
        assert bad_branch.status_code == 400, "Must block direct changes to default branch"

        # Execute on dedicated working branch
        exec_branch = await client.post(
            f"/api/github/repositories/{repo_id}/execute-branch",
            headers=headers_a,
            json={
                "execution_id": f"exc_gh_{suffix}",
                "branch_name": f"forge/hardening-{suffix}",
                "file_path": "src/auth_middleware.py",
                "commit_message": "feat(security): enforce audience claim on JWT",
            },
        )
        assert exec_branch.status_code == 200, exec_branch.text
        gh_res = exec_branch.json()
        assert gh_res["tests"]["success"] is True
        assert gh_res["tests"]["exit_code"] == 0
        assert gh_res["diff"]["has_changes"] is True
        approval_id = gh_res["approval_gate"]["id"]
        exec_id = gh_res["execution_id"]

        # Approve PR gate and verify Pull Request creation (not auto-merged)
        approve_resp = await client.post(
            f"/api/executions/{exec_id}/approvals/{approval_id}",
            headers=headers_a,
            json={"decision": "APPROVED", "comment": "LGTM, tests green."},
        )
        assert approve_resp.status_code == 200, approve_resp.text
        pr_info = approve_resp.json()["pull_request"]
        assert pr_info["status"] == "OPEN"
        assert pr_info["auto_merged"] is False
        assert pr_info["head"] == f"forge/hardening-{suffix}"
        print("[PASS] WORKFLOW C — GitHub branch isolation, sandbox tests, diff & PR approval gate verified.")

        # =====================================================================
        # WORKFLOW D & E — PERSISTENCE & MULTI-TENANT ISOLATION
        # =====================================================================
        # User B attempts to access User A's artifact, execution, and repository
        cross_art = await client.get(f"/api/artifacts/{pptx_meta['id']}", headers=headers_b)
        assert cross_art.status_code == 403, "User B must not access User A's artifact"

        cross_exec = await client.get(f"/api/executions/{exec_id}", headers=headers_b)
        assert cross_exec.status_code == 403, "User B must not access User A's execution"

        snap_b = await client.get("/api/world/snapshot", headers=headers_b)
        assert snap_b.status_code == 200
        assert len(snap_b.json()["artifacts"]) == 0, "User B's artifact list must not leak User A's artifacts"
        print("[PASS] WORKFLOW D & E — Persistence & strict multi-tenant isolation verified.")

        # =====================================================================
        # WORKFLOW F, G & J — EXECUTION QUEUE, FAIRNESS & BACKPRESSURE
        # =====================================================================
        # Submit 1 active + 3 queued workforces for User A (auto_deploy=False so we can inspect queue states deterministically)
        wf_a1 = await client.post(
            "/api/workforces",
            headers=headers_a,
            json={"name": "Alice Job 1", "objective": "Refactor auth module", "auto_deploy": False},
        )
        assert wf_a1.status_code == 200
        assert wf_a1.json()["workforce_status"] == "RUNNING"  # Admitted (slot 1 of 2, Alice active 1 of 1)

        wf_a2 = await client.post(
            "/api/workforces",
            headers=headers_a,
            json={"name": "Alice Job 2", "objective": "Audit API layer", "auto_deploy": False},
        )
        assert wf_a2.status_code == 200
        assert wf_a2.json()["workforce_status"] == "QUEUED"  # Queued because Alice already has 1 active execution!

        # Meanwhile User B submits a job — Fairness ensures User B gets slot 2 of 2 immediately even though Alice queued Job 2!
        wf_b1 = await client.post(
            "/api/workforces",
            headers=headers_b,
            json={"name": "Bob Job 1", "objective": "Zero-trust threat model", "auto_deploy": False},
        )
        assert wf_b1.status_code == 200
        assert wf_b1.json()["workforce_status"] == "RUNNING", "Fairness: Bob must get the 2nd global slot immediately!"

        # Alice queues Job 3 & Job 4 (reaching her MAX_QUEUED_WORKFORCES_PER_USER=3 limit)
        wf_a3 = await client.post(
            "/api/workforces",
            headers=headers_a,
            json={"name": "Alice Job 3", "objective": "Build observability", "auto_deploy": False},
        )
        assert wf_a3.status_code == 200
        wf_a4 = await client.post(
            "/api/workforces",
            headers=headers_a,
            json={"name": "Alice Job 4", "objective": "Optimize shaders", "auto_deploy": False},
        )
        assert wf_a4.status_code == 200

        # Alice's 5th submission exceeds MAX_QUEUED_WORKFORCES_PER_USER=3 -> HTTP 429 Backpressure!
        wf_a5 = await client.post(
            "/api/workforces",
            headers=headers_a,
            json={"name": "Alice Job 5 Overflow", "objective": "Overflow queue test", "auto_deploy": False},
        )
        assert wf_a5.status_code == 429, "Must reject with HTTP 429 when per-user queue limit is reached"
        print("[PASS] WORKFLOW F, G & J — Durable execution queue, cross-user fairness & 429 backpressure verified.")

        # =====================================================================
        # WORKFLOW H & I — LOGOUT SURVIVAL & STALE LEASE RECOVERY
        # =====================================================================
        logout_resp = await client.post("/api/auth/logout", headers=headers_a)
        assert logout_resp.status_code == 200
        assert logout_resp.json()["executions_preserved"] is True

        # Verify stale lease recovery
        async with AsyncSessionLocal() as session:
            async with privileged_rls_context(session):
                active_leases = list(
                    (
                        await session.execute(
                            select(ExecutionLeaseModel).where(ExecutionLeaseModel.status == "ACTIVE")
                        )
                    ).scalars().all()
                )
                assert len(active_leases) >= 1
                # Simulate a crashed worker by backdating expires_at
                crashed_lease = active_leases[0]
                crashed_lease.expires_at = datetime.now(timezone.utc) - timedelta(seconds=30)
                await session.commit()

            recovered = await ExecutionLeaseManager.recover_stale_leases(session)
            assert crashed_lease.execution_id in recovered

            # Clean up test leases so production server starts with clean slots
            for lse in active_leases:
                await ExecutionLeaseManager.release_lease(session, lse.execution_id, "RELEASED")

        print("[PASS] WORKFLOW H & I — Logout execution survival & stale worker lease recovery verified.")


if __name__ == "__main__":
    asyncio.run(run_all_acceptance_workflows())
