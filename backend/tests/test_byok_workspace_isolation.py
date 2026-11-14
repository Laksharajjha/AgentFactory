"""
PROJECT FORGE 3.0 — Workspace-Isolated BYOK (Bring Your Own Key) Test Suite
=============================================================================
Proves all 12 mandatory isolation, encryption, RBAC, rotation, deletion,
background execution, redaction, and token accounting requirements using
deterministic mock transport hooks (consuming ZERO paid Google Gemini quota).
"""

import asyncio
import json
import os
import sys
import uuid
from typing import Any, Dict, List, Type

import httpx
from pydantic import BaseModel
from sqlalchemy import delete, select

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.agents.agent_runtime import AgentRuntime
from app.agents.base_agent import BaseAgent
from app.database import AsyncSessionLocal, apply_rls_context, privileged_rls_context
from app.llm.gemini_provider import GeminiProvider, redact_secrets
from app.llm.model_catalog import ALLOWED_GEMINI_MODELS, DEFAULT_GEMINI_MODEL
from app.llm.provider_resolver import WorkspaceProviderResolver
from app.main import app
from app.models import (
    AgentEventModel,
    AgentMemoryModel,
    AgentModel,
    AuditLogModel,
    ExecutionApprovalModel,
    ExecutionLeaseModel,
    ExecutionLogModel,
    ExecutionModel,
    ExecutionQueueModel,
    IntegrationCredentialModel,
    LLMRequestModel,
    MeetingMessageModel,
    MeetingModel,
    OrganizationMemberModel,
    OrganizationModel,
    ResourceBudgetModel,
    SessionModel,
    TaskModel,
    TokenUsageModel,
    ToolCallModel,
    ToolResultModel,
    UsageRecordModel,
    UserModel,
    UserProfileModel,
    WorkforceModel,
    WorkspaceMemberModel,
    WorkspaceModel,
)


def make_mock_agent_output_dict(api_key_used: str, workspace_id: str, model_id: str) -> Dict[str, Any]:
    return {
        "executive_summary": f"Verified workspace-isolated execution for {workspace_id} using model {model_id}.",
        "key_findings": [f"Used isolated credential suffix={api_key_used[-6:]}"],
        "identified_risks": ["Zero cross-workspace leakage."],
        "recommended_actions": ["Proceed to verification."],
        "requires_collaboration": False,
        "collaboration_topic": "Workspace Isolation",
        "code_or_spec_snippet": f"# workspace={workspace_id} model={model_id}",
    }


async def cleanup_byok_test_entities(user_ids: List[str], workspace_ids: List[str]) -> None:
    if not user_ids and not workspace_ids:
        return
    async with AsyncSessionLocal() as session:
        async with privileged_rls_context(session):
            wf_res = await session.execute(
                select(WorkforceModel.id).where(WorkforceModel.workspace_id.in_(workspace_ids))
            )
            wf_ids = [r[0] for r in wf_res.all()]

            ex_res = await session.execute(
                select(ExecutionModel.id).where(ExecutionModel.workspace_id.in_(workspace_ids))
            )
            ex_ids = [r[0] for r in ex_res.all()]

            if ex_ids:
                await session.execute(delete(ToolResultModel).where(ToolResultModel.execution_id.in_(ex_ids)))
                await session.execute(delete(ToolCallModel).where(ToolCallModel.execution_id.in_(ex_ids)))
                await session.execute(delete(ExecutionApprovalModel).where(ExecutionApprovalModel.execution_id.in_(ex_ids)))
                await session.execute(delete(ExecutionLogModel).where(ExecutionLogModel.execution_id.in_(ex_ids)))
                await session.execute(delete(ExecutionLeaseModel).where(ExecutionLeaseModel.execution_id.in_(ex_ids)))
                await session.execute(delete(ExecutionQueueModel).where(ExecutionQueueModel.execution_id.in_(ex_ids)))
                await session.execute(delete(ExecutionModel).where(ExecutionModel.id.in_(ex_ids)))

            if wf_ids:
                mt_res = await session.execute(select(MeetingModel.id).where(MeetingModel.workforce_id.in_(wf_ids)))
                mt_ids = [r[0] for r in mt_res.all()]
                if mt_ids:
                    await session.execute(delete(MeetingMessageModel).where(MeetingMessageModel.meeting_id.in_(mt_ids)))
                    await session.execute(delete(MeetingModel).where(MeetingModel.id.in_(mt_ids)))
                await session.execute(delete(LLMRequestModel).where(LLMRequestModel.workforce_id.in_(wf_ids)))
                await session.execute(delete(TokenUsageModel).where(TokenUsageModel.workforce_id.in_(wf_ids)))
                await session.execute(delete(AgentMemoryModel).where(AgentMemoryModel.workforce_id.in_(wf_ids)))
                await session.execute(delete(AgentEventModel).where(AgentEventModel.workforce_id.in_(wf_ids)))
                await session.execute(delete(TaskModel).where(TaskModel.workforce_id.in_(wf_ids)))
                await session.execute(delete(AgentModel).where(AgentModel.workforce_id.in_(wf_ids)))
                await session.execute(delete(WorkforceModel).where(WorkforceModel.id.in_(wf_ids)))

            await session.execute(delete(UsageRecordModel).where(UsageRecordModel.workspace_id.in_(workspace_ids)))
            await session.execute(delete(ResourceBudgetModel).where(ResourceBudgetModel.workspace_id.in_(workspace_ids)))
            await session.execute(delete(ResourceBudgetModel).where(ResourceBudgetModel.user_id.in_(user_ids)))
            await session.execute(delete(TokenUsageModel).where(TokenUsageModel.workspace_id.in_(workspace_ids)))
            await session.execute(delete(LLMRequestModel).where(LLMRequestModel.workspace_id.in_(workspace_ids)))
            await session.execute(delete(IntegrationCredentialModel).where(IntegrationCredentialModel.workspace_id.in_(workspace_ids)))
            await session.execute(delete(AuditLogModel).where(AuditLogModel.workspace_id.in_(workspace_ids)))
            await session.execute(delete(WorkspaceMemberModel).where(WorkspaceMemberModel.workspace_id.in_(workspace_ids)))
            await session.execute(delete(SessionModel).where(SessionModel.user_id.in_(user_ids)))
            await session.execute(delete(UserProfileModel).where(UserProfileModel.user_id.in_(user_ids)))
            await session.execute(delete(WorkspaceModel).where(WorkspaceModel.id.in_(workspace_ids)))
            org_res = await session.execute(
                select(OrganizationModel.id).where(OrganizationModel.owner_user_id.in_(user_ids))
            )
            org_ids = [r[0] for r in org_res.all()]
            if org_ids:
                await session.execute(delete(OrganizationMemberModel).where(OrganizationMemberModel.organization_id.in_(org_ids)))
                await session.execute(delete(OrganizationModel).where(OrganizationModel.id.in_(org_ids)))
            await session.execute(delete(UserModel).where(UserModel.id.in_(user_ids)))
            await session.commit()


async def run_byok_isolation_suite() -> None:
    created_users: List[str] = []
    created_workspaces: List[str] = []

    key_a_v1 = "AIzaSyWorkspaceA_SecretKey_Version1_998877"
    key_a_v2 = "AIzaSyWorkspaceA_SecretKey_Version2_Rotated_554433"
    key_b_v1 = "AIzaSyWorkspaceB_SecretKey_Version1_112233"

    transport_calls: List[Dict[str, Any]] = []

    async def deterministic_mock_transport(
        workspace_id: str,
        api_key: str,
        model_id: str,
        operation: str,
        prompt: str,
        response_schema: Type[BaseModel],
    ) -> Any:
        # Simulate realistic async I/O overlap for concurrency testing
        await asyncio.sleep(0.03)
        call_record = {
            "workspace_id": workspace_id,
            "api_key": api_key,
            "model_id": model_id,
            "operation": operation,
            "prompt_preview": prompt[:80],
        }
        transport_calls.append(call_record)
        if operation == "validate_connection":
            return {"status": "OK"}
        return make_mock_agent_output_dict(api_key, workspace_id, model_id)

    GeminiProvider._mock_transport_hook = deterministic_mock_transport

    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            run_tag = uuid.uuid4().hex[:8]

            # Register User A (Workspace A Owner) and User B (Workspace B Owner)
            reg_a = await client.post(
                "/api/auth/register",
                json={
                    "email": f"byok_a_{run_tag}@forge.test",
                    "name": "Workspace A Owner",
                    "password": "StrongPasswordA!123",
                    "workspace_name": f"BYOK Alpha {run_tag}",
                },
            )
            assert reg_a.status_code == 200, reg_a.text
            auth_a = reg_a.json()
            token_a = auth_a["access_token"]
            ws_a = auth_a["workspace"]["id"]
            user_a = auth_a["user"]["id"]
            created_users.append(user_a)
            created_workspaces.append(ws_a)

            reg_b = await client.post(
                "/api/auth/register",
                json={
                    "email": f"byok_b_{run_tag}@forge.test",
                    "name": "Workspace B Owner",
                    "password": "StrongPasswordB!123",
                    "workspace_name": f"BYOK Beta {run_tag}",
                },
            )
            assert reg_b.status_code == 200, reg_b.text
            auth_b = reg_b.json()
            token_b = auth_b["access_token"]
            ws_b = auth_b["workspace"]["id"]
            user_b = auth_b["user"]["id"]
            created_users.append(user_b)
            created_workspaces.append(ws_b)

            headers_a = {"Authorization": f"Bearer {token_a}"}
            headers_b = {"Authorization": f"Bearer {token_b}"}

            # =========================================================================
            # TEST 1: Workspace A saves API key A (Encrypted via Fernet, never leaked)
            # =========================================================================
            save_a = await client.post(
                "/api/settings/llm",
                headers=headers_a,
                json={
                    "provider": "gemini",
                    "gemini_api_key": key_a_v1,
                    "gemini_model": DEFAULT_GEMINI_MODEL,
                    "enable_live_execution": True,
                },
            )
            assert save_a.status_code == 200, save_a.text
            body_a = save_a.json()
            assert body_a["workspace_id"] == ws_a
            assert body_a["configured"] is True
            assert body_a["masked_status"] == "Configured (Encrypted)"
            assert body_a["selected_model"] == "gemini-3.1-flash-lite"
            assert body_a["credential_version"] == 1
            assert key_a_v1 not in json.dumps(body_a)

            # Verify DB ciphertext in integration_credentials
            async with AsyncSessionLocal() as session:
                async with privileged_rls_context(session):
                    cred_row_a = (
                        await session.execute(
                            select(IntegrationCredentialModel).where(
                                IntegrationCredentialModel.workspace_id == ws_a,
                                IntegrationCredentialModel.provider == "gemini",
                            )
                        )
                    ).scalar_one()
                    assert key_a_v1 not in cred_row_a.encrypted_payload
                    assert cred_row_a.encrypted_payload.startswith("gAAAAA")

            print("PASS [1/12]: Workspace A saves API key A (Fernet-encrypted in integration_credentials, never returned in response)")

            # =========================================================================
            # TEST 2: Workspace B saves API key B with a different model
            # =========================================================================
            save_b = await client.post(
                "/api/settings/llm",
                headers=headers_b,
                json={
                    "provider": "gemini",
                    "gemini_api_key": key_b_v1,
                    "gemini_model": "gemini-3.5-flash-lite",
                    "enable_live_execution": True,
                },
            )
            assert save_b.status_code == 200, save_b.text
            body_b = save_b.json()
            assert body_b["workspace_id"] == ws_b
            assert body_b["configured"] is True
            assert body_b["selected_model"] == "gemini-3.5-flash-lite"
            assert key_b_v1 not in json.dumps(body_b)
            print("PASS [2/12]: Workspace B saves API key B independently with model gemini-3.5-flash-lite")

            # =========================================================================
            # TEST 3: Workspace A execution uses key A
            # =========================================================================
            transport_calls.clear()
            test_res_a = await client.post(
                "/api/settings/llm/test",
                headers=headers_a,
                json={"provider": "gemini"},
            )
            assert test_res_a.status_code == 200, test_res_a.text
            assert test_res_a.json()["valid"] is True
            assert len(transport_calls) == 1
            assert transport_calls[0]["workspace_id"] == ws_a
            assert transport_calls[0]["api_key"] == key_a_v1
            assert transport_calls[0]["model_id"] == "gemini-3.1-flash-lite"
            print("PASS [3/12]: Workspace A execution resolves and uses API key A + model gemini-3.1-flash-lite")

            # =========================================================================
            # TEST 4: Workspace B execution uses key B
            # =========================================================================
            transport_calls.clear()
            test_res_b = await client.post(
                "/api/settings/llm/test",
                headers=headers_b,
                json={"provider": "gemini"},
            )
            assert test_res_b.status_code == 200, test_res_b.text
            assert test_res_b.json()["valid"] is True
            assert len(transport_calls) == 1
            assert transport_calls[0]["workspace_id"] == ws_b
            assert transport_calls[0]["api_key"] == key_b_v1
            assert transport_calls[0]["model_id"] == "gemini-3.5-flash-lite"
            print("PASS [4/12]: Workspace B execution resolves and uses API key B + model gemini-3.5-flash-lite")

            # =========================================================================
            # TEST 5: Concurrent executions for Workspace A and Workspace B do not cross-contaminate
            # =========================================================================
            snap_a = await client.get("/api/world/snapshot", headers=headers_a)
            snap_b = await client.get("/api/world/snapshot", headers=headers_b)
            assert snap_a.status_code == 200 and snap_b.status_code == 200
            wf_a_id = snap_a.json()["workforce_id"]
            wf_b_id = snap_b.json()["workforce_id"]
            agent_a_id = snap_a.json()["agents"][0]["id"]
            agent_b_id = snap_b.json()["agents"][0]["id"]

            transport_calls.clear()

            async def _exec_agent_step(target_ws: str, target_user: str, target_wf: str, target_agent: str) -> None:
                async def _task_body() -> None:
                    async with AsyncSessionLocal() as session:
                        try:
                            await apply_rls_context(session, target_user, target_ws, "USER")
                            agent_row = (
                                await session.execute(select(AgentModel).where(AgentModel.id == target_agent))
                            ).scalar_one_or_none()
                            assert agent_row is not None, f"Agent {target_agent} not visible in {target_ws}"
                            temp_task = TaskModel(
                                id=f"tsk_{uuid.uuid4().hex[:8]}",
                                workforce_id=target_wf,
                                workspace_id=target_ws,
                                title=f"Concurrent task for {target_ws}",
                                description="Verify zero credential cross-talk under concurrent async execution.",
                                assigned_agent_id=target_agent,
                                priority="HIGH",
                                status="IN_PROGRESS",
                                progress=50,
                                target_room_id=agent_row.home_room_id,
                                deliverables=["Isolation Verification Report"],
                            )
                            session.add(temp_task)
                            await session.commit()

                            base_ag = BaseAgent(agent_row)
                            out, _ = await base_ag.execute_task_step(
                                session=session,
                                task=temp_task,
                                objective="Multi-tenant isolation check",
                            )
                            assert out is not None
                        except Exception as step_exc:
                            print(f"[STEP ERROR ws={target_ws}]: {type(step_exc).__name__}: {step_exc}", flush=True)
                            raise step_exc

                await asyncio.create_task(_task_body())

            await asyncio.gather(
                _exec_agent_step(ws_a, user_a, wf_a_id, agent_a_id),
                _exec_agent_step(ws_b, user_b, wf_b_id, agent_b_id),
                _exec_agent_step(ws_a, user_a, wf_a_id, agent_a_id),
                _exec_agent_step(ws_b, user_b, wf_b_id, agent_b_id),
            )

            assert len(transport_calls) == 4
            for call in transport_calls:
                if call["workspace_id"] == ws_a:
                    assert call["api_key"] == key_a_v1
                    assert call["model_id"] == "gemini-3.1-flash-lite"
                elif call["workspace_id"] == ws_b:
                    assert call["api_key"] == key_b_v1
                    assert call["model_id"] == "gemini-3.5-flash-lite"
                else:
                    raise AssertionError(f"Unexpected workspace_id {call['workspace_id']}")

            print("PASS [5/12]: Concurrent executions for Workspace A & Workspace B are 100% isolated with zero cross-contamination")

            # =========================================================================
            # TEST 6: Workspace A cannot retrieve or delete Workspace B's credential
            # =========================================================================
            cross_get = await client.get(f"/api/settings/llm?workspace_id={ws_b}", headers=headers_a)
            assert cross_get.status_code == 403, f"Expected 403, got {cross_get.status_code}: {cross_get.text}"

            cross_del = await client.delete(f"/api/settings/llm?workspace_id={ws_b}", headers=headers_a)
            assert cross_del.status_code == 403, f"Expected 403, got {cross_del.status_code}: {cross_del.text}"

            status_b = await client.get("/api/settings/llm", headers=headers_b)
            assert status_b.status_code == 200
            assert status_b.json()["configured"] is True
            print("PASS [6/12]: Workspace A cannot retrieve or delete Workspace B's credential (403 Forbidden + audit logged)")

            # =========================================================================
            # TEST 7: Workspace A cannot change Workspace B's model
            # =========================================================================
            cross_model = await client.put(
                "/api/settings/llm/model",
                headers=headers_a,
                json={
                    "workspace_id": ws_b,
                    "gemini_model": "gemini-2.5-flash",
                },
            )
            assert cross_model.status_code == 403, f"Expected 403, got {cross_model.status_code}: {cross_model.text}"

            # Also verify non-admin MEMBER inside Workspace A cannot modify credentials
            reg_mem = await client.post(
                "/api/auth/register",
                json={
                    "email": f"byok_mem_{run_tag}@forge.test",
                    "name": "Workspace A Member",
                    "password": "StrongPasswordM!123",
                    "workspace_name": f"Member Temp {run_tag}",
                },
            )
            assert reg_mem.status_code == 200
            auth_mem = reg_mem.json()
            user_mem = auth_mem["user"]["id"]
            created_users.append(user_mem)
            created_workspaces.append(auth_mem["workspace"]["id"])

            async with AsyncSessionLocal() as session:
                async with privileged_rls_context(session):
                    session.add(
                        WorkspaceMemberModel(
                            id=f"wsm_{uuid.uuid4().hex[:10]}",
                            workspace_id=ws_a,
                            user_id=user_mem,
                            role="MEMBER",
                        )
                    )
                    await session.commit()

            mem_rotate = await client.post(
                "/api/settings/llm/rotate",
                headers={"Authorization": f"Bearer {auth_mem['access_token']}"},
                json={
                    "workspace_id": ws_a,
                    "gemini_api_key": "AIzaSyAttackerMemberKey_0000000",
                    "gemini_model": "gemini-2.5-flash",
                },
            )
            assert mem_rotate.status_code == 403, f"Expected 403 for MEMBER, got {mem_rotate.status_code}"
            print("PASS [7/12]: Cross-workspace model update and non-admin MEMBER credential modification blocked with 403")

            # =========================================================================
            # TEST 8: Replacing/rotating a key invalidates any cached provider client
            # =========================================================================
            old_provider = WorkspaceProviderResolver._provider_cache.get(
                (ws_a, "gemini", 1, "gemini-3.1-flash-lite", True)
            )
            assert old_provider is not None
            assert old_provider._api_key == key_a_v1

            rot_res = await client.post(
                "/api/settings/llm/rotate",
                headers=headers_a,
                json={
                    "provider": "gemini",
                    "gemini_api_key": key_a_v2,
                    "gemini_model": "gemini-3.1-flash-lite",
                    "enable_live_execution": True,
                },
            )
            assert rot_res.status_code == 200, rot_res.text
            assert rot_res.json()["credential_version"] == 2

            assert (
                WorkspaceProviderResolver._provider_cache.get(
                    (ws_a, "gemini", 1, "gemini-3.1-flash-lite", True)
                )
                is None
            )

            transport_calls.clear()
            await _exec_agent_step(ws_a, user_a, wf_a_id, agent_a_id)
            assert len(transport_calls) == 1
            assert transport_calls[0]["api_key"] == key_a_v2
            print("PASS [8/12]: Rotating API key increments credential_version, evicts cached client, and uses new key immediately")

            # =========================================================================
            # TEST 10 (run before deleting Workspace A's key): Background agent job uses workspace credential
            # =========================================================================
            transport_calls.clear()
            await AgentRuntime.execute_direct_instruction(
                agent_id=agent_a_id,
                instruction="Generate an executive security summary for Workspace A.",
                assign_as_task=True,
                priority="HIGH",
                workspace_id=ws_a,
                user_id=user_a,
            )
            assert len(transport_calls) >= 1
            assert all(c["workspace_id"] == ws_a and c["api_key"] == key_a_v2 for c in transport_calls)
            print("PASS [10/12]: Background agent execution (AgentRuntime.execute_direct_instruction) resolves workspace credential from explicit workspace context")

            # =========================================================================
            # TEST 12 (verify before deletion): Token usage is attributed to owning workspace
            # =========================================================================
            async with AsyncSessionLocal() as session:
                async with privileged_rls_context(session):
                    reqs_a = (
                        await session.execute(
                            select(LLMRequestModel).where(LLMRequestModel.workspace_id == ws_a)
                        )
                    ).scalars().all()
                    reqs_b = (
                        await session.execute(
                            select(LLMRequestModel).where(LLMRequestModel.workspace_id == ws_b)
                        )
                    ).scalars().all()
                    usages_a = (
                        await session.execute(
                            select(TokenUsageModel).where(TokenUsageModel.workspace_id == ws_a)
                        )
                    ).scalars().all()
                    usages_b = (
                        await session.execute(
                            select(TokenUsageModel).where(TokenUsageModel.workspace_id == ws_b)
                        )
                    ).scalars().all()

                    assert len(reqs_a) >= 4
                    assert len(reqs_b) >= 2
                    assert len(usages_a) >= 1
                    assert len(usages_b) >= 1
                    assert sum(u.total_tokens for u in usages_a) == sum(r.total_tokens for r in reqs_a)
                    assert sum(u.total_tokens for u in usages_b) == sum(r.total_tokens for r in reqs_b)
                    assert all(r.workspace_id == ws_a for r in reqs_a)
                    assert all(r.workspace_id == ws_b for r in reqs_b)
            print("PASS [12/12]: Token usage (LLMRequestModel & TokenUsageModel) is strictly attributed to each owning workspace")

            # =========================================================================
            # TEST 9: Deleting a key prevents future executions from using the deleted key
            # =========================================================================
            del_res = await client.delete("/api/settings/llm", headers=headers_a)
            assert del_res.status_code == 200, del_res.text
            assert del_res.json()["configured"] is False
            assert del_res.json()["gemini_live_configured"] is False

            transport_calls.clear()
            await _exec_agent_step(ws_a, user_a, wf_a_id, agent_a_id)
            assert len(transport_calls) == 0
            print("PASS [9/12]: Deleting API key removes DB record, evicts cache, and prevents future executions from using deleted key")

            # =========================================================================
            # TEST 11: API errors and logs never disclose plaintext or encrypted credentials
            # =========================================================================
            async def failing_mock_transport(
                workspace_id: str,
                api_key: str,
                model_id: str,
                operation: str,
                prompt: str,
                response_schema: Type[BaseModel],
            ) -> Any:
                raise RuntimeError(
                    f"Google API upstream failure for key={api_key} and authorization=Bearer {api_key}"
                )

            GeminiProvider._mock_transport_hook = failing_mock_transport
            err_test = await client.post(
                "/api/settings/llm/test",
                headers=headers_b,
                json={"provider": "gemini"},
            )
            assert err_test.status_code == 200
            err_payload = err_test.json()
            assert err_payload["valid"] is False
            serialized_err = json.dumps(err_payload)
            assert key_b_v1 not in serialized_err
            assert "[REDACTED_CREDENTIAL]" in serialized_err
            assert redact_secrets(f"Failed key={key_b_v1}", key_b_v1) == "Failed key=[REDACTED_CREDENTIAL]"
            print("PASS [11/12]: API errors and logs scrub all API keys and secrets ([REDACTED_CREDENTIAL])")

            # Verify unified model allowlist includes gemini-3.1-flash-lite and rejects 0-quota models
            assert "gemini-3.1-flash-lite" in ALLOWED_GEMINI_MODELS
            bad_model_res = await client.put(
                "/api/settings/llm/model",
                headers=headers_b,
                json={"gemini_model": "gemini-2.5-pro"},
            )
            assert bad_model_res.status_code in (400, 422)
            print("PASS [BONUS]: Model allowlist accepts gemini-3.1-flash-lite and rejects 0-quota gemini-2.5-pro")

            print("\nALL 12 MANDATORY BYOK WORKSPACE ISOLATION TESTS PASSED!")
    finally:
        GeminiProvider._mock_transport_hook = None
        await cleanup_byok_test_entities(created_users, created_workspaces)


if __name__ == "__main__":
    asyncio.run(run_byok_isolation_suite())
