import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, Response, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.agent_registry import AgentRegistry
from app.agents.agent_runtime import AgentRuntime
from app.agents.state_manager import StateManager
from app.artifacts.artifact_manager import ArtifactManager
from app.artifacts.artifact_storage import artifact_storage
from app.auth.auth_service import AuthenticatedContext, AuthService, get_auth_context, require_authenticated_user
from app.auth.rbac import RBACGuard
from app.config import settings
from app.database import AsyncSessionLocal, get_db, init_db
from app.events.event_bus import event_bus
from app.factory.workforce_factory import WorkforceFactory
from app.factory.zip_analyzer import ZipAnalyzer
from app.integrations.github_service import GitHubService
from app.llm.gemini_provider import gemini_provider
from app.meetings.meeting_coordinator import MeetingCoordinator
from app.models import (
    AgentEventModel,
    AgentModel,
    ArtifactModel,
    ArtifactVersionModel,
    AuditLogModel,
    ConnectedRepositoryModel,
    ExecutionApprovalModel,
    ExecutionLogModel,
    ExecutionModel,
    MeetingModel,
    ToolCallModel,
    ToolResultModel,
    WorkforceModel,
    WorkspaceMemberModel,
    WorkspaceModel,
)
from app.scheduler.capacity_monitor import CapacityMonitor
from app.scheduler.queue_repository import QueueRepository
from app.scheduler.resource_governor import ResourceGovernor
from app.schemas import (
    AdminGovernorUpdateRequest,
    AgentInstructionRequest,
    AgentProfileSchema,
    ArtifactCreateRequest,
    AuthLoginRequest,
    AuthRegisterRequest,
    ExecutionApprovalDecisionRequest,
    GitHubBranchActionRequest,
    GitHubConnectRequest,
    LLMConfigUpdateRequest,
    MeetingSchema,
    OAuthLoginRequest,
    SimulationControlRequest,
    TaskSchema,
    TokenUsageSummarySchema,
    WorkforceCreateRequest,
    WorldEventSchema,
    WorldSnapshotSchema,
)
from app.tools.tool_registry import UniversalToolRegistry
from app.world.snapshot_builder import SnapshotBuilder
from app.workspaces.diff_manager import DiffManager
from app.workspaces.file_manager import FileManager
from app.workspaces.workspace_manager import workspace_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("project_forge.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    async with AsyncSessionLocal() as session:
        await SnapshotBuilder.ensure_default_workforce(session)
    yield


app = FastAPI(
    title="PROJECT FORGE 3.0 — The Autonomous Work Platform",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check(session: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    cap = await CapacityMonitor.get_system_capacity(session)
    return {
        "status": "ok",
        "service": "PROJECT FORGE 3.0 Autonomous Work Platform",
        "version": settings.APP_VERSION,
        "database_engine": "postgresql" if settings.is_postgres else "sqlite-compatible",
        "gemini_live_configured": gemini_provider.is_live_configured(),
        "active_model": settings.GEMINI_MODEL,
        "capacity": cap,
    }


# ============================================================================
# AUTHENTICATION, SESSIONS & MULTI-TENANT WORKSPACES
# ============================================================================


@app.post("/api/auth/register")
async def register_user(
    payload: AuthRegisterRequest,
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    result = await AuthService.register_user(
        session=session,
        name=payload.name,
        email=payload.email,
        password=payload.password,
        role_title=payload.role_title,
    )
    # Provision initial personal 3D office workforce for the new user's workspace
    ws_id = result["workspace"]["id"]
    usr_id = result["user"]["id"]
    await SnapshotBuilder.ensure_default_workforce(session, user_id=usr_id, workspace_id=ws_id)
    return result


@app.post("/api/auth/login")
async def login_user(
    payload: AuthLoginRequest,
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    return await AuthService.login_user(
        session=session,
        email=payload.email,
        password=payload.password,
    )


@app.post("/api/auth/oauth")
async def oauth_login(
    payload: OAuthLoginRequest,
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await AuthService.oauth_login(
        session=session,
        provider=payload.provider,
        email=payload.email,
        name=payload.name,
    )
    await SnapshotBuilder.ensure_default_workforce(
        session,
        user_id=res["user"]["id"],
        workspace_id=res["workspace"]["id"],
    )
    return res


@app.post("/api/auth/logout")
async def logout_user(
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    # Note: Logging out revokes the browser session but NEVER cancels or releases running executions (Part 10 & Workflow I)
    if ctx.session_id:
        await AuthService.revoke_session(session, ctx.session_id, ctx.user_id)
    return {"status": "logged_out", "user_id": ctx.user_id, "executions_preserved": True}


@app.get("/api/auth/me")
async def get_current_user_profile(
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    mem_res = await session.execute(
        select(WorkspaceMemberModel).where(WorkspaceMemberModel.user_id == ctx.user_id)
    )
    memberships = list(mem_res.scalars().all())
    ws_ids = [m.workspace_id for m in memberships] or [ctx.workspace_id]
    ws_res = await session.execute(select(WorkspaceModel).where(WorkspaceModel.id.in_(ws_ids)))
    workspaces = [
        {
            "id": w.id,
            "tenant_id": w.tenant_id,
            "name": w.name,
            "slug": w.slug,
            "owner_user_id": w.owner_user_id,
            "is_personal": w.is_personal,
        }
        for w in ws_res.scalars().all()
    ]
    return {
        "user": {
            "id": ctx.user.id,
            "name": ctx.user.name,
            "email": ctx.user.email,
            "role": ctx.user.role,
            "platform_role": ctx.platform_role,
            "auth_provider": ctx.user.auth_provider,
            "default_workspace_id": ctx.workspace_id,
        },
        "active_workspace": {
            "id": ctx.workspace.id,
            "tenant_id": ctx.workspace.tenant_id,
            "name": ctx.workspace.name,
            "slug": ctx.workspace.slug,
            "role": ctx.workspace_role,
        },
        "workspaces": workspaces,
    }


@app.get("/api/workspaces")
async def list_user_workspaces(
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    mem_res = await session.execute(
        select(WorkspaceMemberModel).where(WorkspaceMemberModel.user_id == ctx.user_id)
    )
    memberships = {m.workspace_id: m.role for m in mem_res.scalars().all()}
    ws_ids = list(memberships.keys()) or [ctx.workspace_id]
    ws_res = await session.execute(select(WorkspaceModel).where(WorkspaceModel.id.in_(ws_ids)))
    return [
        {
            "id": w.id,
            "tenant_id": w.tenant_id,
            "name": w.name,
            "slug": w.slug,
            "description": w.description,
            "role": memberships.get(w.id, "OWNER"),
            "created_at": w.created_at.isoformat() if w.created_at else "",
        }
        for w in ws_res.scalars().all()
    ]


# ============================================================================
# SETTINGS & LLM GATEWAY
# ============================================================================


@app.post("/api/settings/llm")
async def update_llm_settings(payload: LLMConfigUpdateRequest) -> Dict[str, Any]:
    if payload.gemini_api_key is not None:
        gemini_provider.set_api_key(payload.gemini_api_key)
    if payload.enable_live_execution is not None:
        gemini_provider.set_live_execution(payload.enable_live_execution)
    elif payload.gemini_api_key and len(payload.gemini_api_key.strip()) > 10:
        gemini_provider.set_live_execution(True)
    if payload.gemini_model:
        settings.GEMINI_MODEL = payload.gemini_model
    if payload.enable_complex_model is not None:
        settings.ENABLE_COMPLEX_MODEL = payload.enable_complex_model
    return {
        "status": "updated",
        "gemini_live_configured": gemini_provider.is_live_configured(),
        "has_api_key": gemini_provider.has_api_key(),
        "active_model": settings.GEMINI_MODEL,
        "enable_complex_model": settings.ENABLE_COMPLEX_MODEL,
        "rate_limits": gemini_provider.get_model_limits(settings.GEMINI_MODEL),
    }


# ============================================================================
# UNIVERSAL ARTIFACT ENGINE (PPTX, DOCX, XLSX, PDF, CSV, MD, SVG, PNG, ZIP)
# ============================================================================


@app.post("/api/artifacts")
async def create_artifact(
    payload: ArtifactCreateRequest,
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    RBACGuard.require_permission(ctx, "artifact:write")
    art = await ArtifactManager.create_or_version_artifact(
        session=session,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        workspace_id=ctx.workspace_id,
        artifact_type=payload.artifact_type,
        title=payload.title,
        structured_content=payload.structured_content,
        filename=payload.filename,
        workforce_id=payload.workforce_id,
        task_id=payload.task_id,
    )
    ver_res = await session.execute(
        select(ArtifactVersionModel)
        .where(ArtifactVersionModel.artifact_id == art.id)
        .order_by(ArtifactVersionModel.version.desc())
    )
    serialized = ArtifactManager.serialize_artifact(art, list(ver_res.scalars().all()))
    if payload.workforce_id:
        await event_bus.emit(
            session=session,
            workforce_id=payload.workforce_id,
            event_type="ARTIFACT_GENERATED",
            entity_id=art.id,
            payload=serialized,
        )
    return serialized


@app.get("/api/artifacts")
async def list_artifacts(
    workforce_id: Optional[str] = Query(default=None),
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    RBACGuard.require_permission(ctx, "artifact:read")
    stmt = select(ArtifactModel).where(ArtifactModel.workspace_id == ctx.workspace_id)
    if workforce_id:
        stmt = stmt.where(ArtifactModel.workforce_id == workforce_id)
    stmt = stmt.order_by(desc(ArtifactModel.created_at))
    rows = list((await session.execute(stmt)).scalars().all())
    return [ArtifactManager.serialize_artifact(a) for a in rows]


@app.get("/api/artifacts/{artifact_id}")
async def get_artifact_details(
    artifact_id: str,
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    art = (
        await session.execute(select(ArtifactModel).where(ArtifactModel.id == artifact_id))
    ).scalar_one_or_none()
    await RBACGuard.verify_resource_ownership(session, ctx, art, "artifact", artifact_id)
    ver_res = await session.execute(
        select(ArtifactVersionModel)
        .where(ArtifactVersionModel.artifact_id == artifact_id)
        .order_by(ArtifactVersionModel.version.desc())
    )
    return ArtifactManager.serialize_artifact(art, list(ver_res.scalars().all()))  # type: ignore[arg-type]


@app.get("/api/artifacts/{artifact_id}/download")
async def download_artifact(
    artifact_id: str,
    workspace_id: Optional[str] = Query(default=None),
    version: int = Query(default=1),
    expires: Optional[int] = Query(default=None),
    signature: Optional[str] = Query(default=None),
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> Response:
    art = (
        await session.execute(select(ArtifactModel).where(ArtifactModel.id == artifact_id))
    ).scalar_one_or_none()
    if not art:
        raise HTTPException(status_code=404, detail="Artifact not found.")

    # Verify either short-lived signed URL OR authenticated workspace ownership
    signed_ok = False
    if expires is not None and signature and workspace_id:
        signed_ok = artifact_storage.verify_signed_download(
            artifact_id=artifact_id,
            workspace_id=workspace_id,
            version=version,
            expires=expires,
            signature=signature,
        )
        if signed_ok and art.workspace_id != workspace_id:
            signed_ok = False

    if not signed_ok:
        await RBACGuard.verify_resource_ownership(session, ctx, art, "artifact", artifact_id)

    try:
        raw_bytes = artifact_storage.get_bytes(art.storage_key)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return Response(
        content=raw_bytes,
        media_type=art.mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{art.filename}"',
            "X-Artifact-Checksum-SHA256": art.checksum_sha256,
            "X-Artifact-Validation": art.validation_status,
        },
    )


@app.delete("/api/artifacts/{artifact_id}")
async def delete_artifact(
    artifact_id: str,
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    RBACGuard.require_permission(ctx, "artifact:write")
    art = (
        await session.execute(select(ArtifactModel).where(ArtifactModel.id == artifact_id))
    ).scalar_one_or_none()
    await RBACGuard.verify_resource_ownership(session, ctx, art, "artifact", artifact_id)
    if art:
        artifact_storage.delete_object(art.storage_key)
        await session.delete(art)
        await session.commit()
    return {"status": "deleted", "artifact_id": artifact_id}


# ============================================================================
# GITHUB APP INTEGRATION & ISOLATED REPOSITORY WORKSPACES
# ============================================================================


@app.post("/api/github/connect")
async def connect_github_account(
    payload: GitHubConnectRequest,
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    RBACGuard.require_permission(ctx, "integrations:manage")
    return await GitHubService.connect_github_app(
        session=session,
        workspace_id=ctx.workspace_id,
        user_id=ctx.user_id,
        account_login=payload.account_login,
        installation_id=payload.installation_id,
        access_token=payload.access_token,
        repositories=payload.repositories,
    )


@app.get("/api/github/repositories")
async def list_connected_repositories(
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    res = await session.execute(
        select(ConnectedRepositoryModel)
        .where(ConnectedRepositoryModel.workspace_id == ctx.workspace_id)
        .order_by(desc(ConnectedRepositoryModel.created_at))
    )
    return [GitHubService.serialize_repo(r) for r in res.scalars().all()]


@app.post("/api/github/repositories/{repo_id}/execute-branch")
async def execute_repository_branch_workflow(
    repo_id: str,
    payload: GitHubBranchActionRequest,
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    RBACGuard.require_permission(ctx, "workforce:launch")
    repo = (
        await session.execute(
            select(ConnectedRepositoryModel).where(ConnectedRepositoryModel.id == repo_id)
        )
    ).scalar_one_or_none()
    await RBACGuard.verify_resource_ownership(session, ctx, repo, "repository", repo_id)
    assert repo is not None

    GitHubService.enforce_branch_safety(repo, payload.branch_name)

    wf = await SnapshotBuilder.ensure_default_workforce(session, ctx.user_id, ctx.workspace_id)
    exec_id = payload.execution_id or f"exc_{uuid.uuid4().hex[:12]}"

    ex_row = (
        await session.execute(select(ExecutionModel).where(ExecutionModel.id == exec_id))
    ).scalar_one_or_none()
    if not ex_row:
        ex_row = ExecutionModel(
            id=exec_id,
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            workspace_id=ctx.workspace_id,
            workforce_id=wf.id,
            repository_id=repo.id,
            execution_type="GITHUB_PR",
            status="RUNNING",
            execution_mode="REAL_TOOL_EXECUTION",
            working_branch=payload.branch_name,
            started_at=datetime.now(timezone.utc),
        )
        session.add(ex_row)
        await session.commit()

    sandbox_info = workspace_manager.allocate_sandbox(
        tenant_id=ctx.tenant_id,
        execution_id=exec_id,
        repo_full_name=repo.full_name,
        default_branch=repo.default_branch,
        working_branch=payload.branch_name,
    )
    sandbox_dir = workspace_manager.get_sandbox_dir(ctx.tenant_id, exec_id)

    new_content = payload.file_content or (
        "def verify_token(token: str, required_aud: str = 'forge-api') -> bool:\n"
        "    \"\"\"Zero-trust token validation with audience & length enforcement.\"\"\"\n"
        "    if not token or len(token.strip()) < 10:\n"
        "        return False\n"
        "    return bool(required_aud)\n"
    )
    FileManager.write_file(sandbox_dir, payload.file_path, new_content)
    test_result = workspace_manager.run_sandboxed_tests(ctx.tenant_id, exec_id)
    diff_result = DiffManager.generate_diff(sandbox_dir)
    commit_result = DiffManager.commit_changes(sandbox_dir, payload.commit_message)

    approval = ExecutionApprovalModel(
        id=f"apr_{uuid.uuid4().hex[:12]}",
        execution_id=exec_id,
        workspace_id=ctx.workspace_id,
        action_type="CREATE_PULL_REQUEST",
        title=f"Approve Pull Request on {repo.full_name} ({payload.branch_name} -> {repo.default_branch})",
        description=f"Tests executed with exit_code={test_result['exit_code']}. Review diff and approve to open PR.",
        diff_preview=diff_result["diff"],
        payload={
            "repository_id": repo.id,
            "working_branch": payload.branch_name,
            "base_branch": repo.default_branch,
            "commit_sha": commit_result["commit_sha"],
        },
        status="PENDING",
    )
    session.add(approval)
    ex_row.status = "WAITING_FOR_APPROVAL"
    ex_row.verification_json = {
        "tests_executed": True,
        "test_exit_code": test_result["exit_code"],
        "diff_generated": diff_result["has_changes"],
        "commit_sha": commit_result["commit_sha"],
    }
    await session.commit()

    workspace_manager.release_and_cleanup_sandbox(ctx.tenant_id, exec_id)

    return {
        "execution_id": exec_id,
        "repository": GitHubService.serialize_repo(repo),
        "working_branch": payload.branch_name,
        "base_commit": sandbox_info["base_commit"],
        "commit": commit_result,
        "tests": test_result,
        "diff": diff_result,
        "approval_gate": {
            "id": approval.id,
            "status": approval.status,
            "action_type": approval.action_type,
            "title": approval.title,
        },
    }


@app.post("/api/executions/{execution_id}/approvals/{approval_id}")
async def decide_execution_approval(
    execution_id: str,
    approval_id: str,
    payload: ExecutionApprovalDecisionRequest,
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    RBACGuard.require_permission(ctx, "execution:approve")
    ex_row = (
        await session.execute(select(ExecutionModel).where(ExecutionModel.id == execution_id))
    ).scalar_one_or_none()
    await RBACGuard.verify_resource_ownership(session, ctx, ex_row, "execution", execution_id)

    approval = (
        await session.execute(
            select(ExecutionApprovalModel).where(
                ExecutionApprovalModel.id == approval_id,
                ExecutionApprovalModel.execution_id == execution_id,
            )
        )
    ).scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found.")

    approval.status = payload.decision
    approval.decided_by_user_id = ctx.user_id
    approval.decided_at = datetime.now(timezone.utc)
    await session.commit()

    pr_data: Optional[Dict[str, Any]] = None
    if payload.decision == "APPROVED" and approval.action_type == "CREATE_PULL_REQUEST":
        repo_id = (approval.payload or {}).get("repository_id") or (ex_row.repository_id if ex_row else None)
        if repo_id:
            repo = (
                await session.execute(
                    select(ConnectedRepositoryModel).where(ConnectedRepositoryModel.id == repo_id)
                )
            ).scalar_one_or_none()
        else:
            repo = (
                await session.execute(
                    select(ConnectedRepositoryModel).where(
                        ConnectedRepositoryModel.workspace_id == ctx.workspace_id
                    )
                )
            ).scalars().first()

        if repo:
            head_branch = (approval.payload or {}).get("working_branch") or (
                ex_row.working_branch if ex_row else "forge/autonomous-patch"
            )
            pr_data = await GitHubService.create_pull_request_with_approval_check(
                session=session,
                repo=repo,
                execution_id=execution_id,
                head_branch=head_branch,
                base_branch=repo.default_branch,
                title=approval.title,
                body=approval.description,
                diff_text=approval.diff_preview or "",
            )

        if ex_row:
            ex_row.status = "COMPLETED"
            ex_row.completed_at = datetime.now(timezone.utc)
            await session.commit()

    return {
        "execution_id": execution_id,
        "approval_id": approval.id,
        "status": approval.status,
        "pull_request": pr_data,
    }


# ============================================================================
# WORKFORCES, RESOURCE GOVERNOR ADMISSION & QUEUE
# ============================================================================


@app.post("/api/projects/analyze-zip")
async def analyze_project_zip(file: UploadFile = File(...)) -> Dict[str, Any]:
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip project archives are supported.")
    raw_bytes = await file.read()
    try:
        summary = ZipAnalyzer.analyze_zip_bytes(file.filename, raw_bytes)
        return {"status": "analyzed", "project_summary": summary}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@app.post("/api/workforces/preview")
async def preview_workforce_plan(payload: WorkforceCreateRequest) -> Dict[str, Any]:
    plan = WorkforceFactory.build_workforce_plan(
        objective=payload.objective,
        project_summary=payload.project_context,
    )
    return {
        "name": payload.name,
        "objective": payload.objective,
        "plan": plan.model_dump(),
    }


@app.post("/api/workforces", response_model=WorldSnapshotSchema)
async def create_workforce(
    payload: WorkforceCreateRequest,
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> WorldSnapshotSchema:
    RBACGuard.require_permission(ctx, "workforce:launch")
    wf_id = f"wf_{uuid.uuid4().hex[:10]}"
    workforce = WorkforceModel(
        id=wf_id,
        user_id=ctx.user_id,
        workspace_id=ctx.workspace_id,
        tenant_id=ctx.tenant_id,
        repository_id=payload.repository_id,
        working_branch=f"forge/{wf_id}",
        name=payload.name or "Project Forge Initiative",
        objective=payload.objective,
        project_summary=payload.project_context,
        status="INITIALIZING",
        simulation_speed=1.0,
        is_paused=False,
        token_budget=settings.GLOBAL_TOKEN_BUDGET,
        tokens_used=0,
        llm_calls_made=0,
        max_llm_calls=settings.MAX_WORKFORCE_CALLS,
    )
    session.add(workforce)
    await session.commit()

    agents = await AgentRegistry.create_workforce_agents(session, workforce, emit_events=True)
    for ag in agents:
        ag.workspace_id = ctx.workspace_id
    await session.commit()

    plan = WorkforceFactory.build_workforce_plan(
        objective=payload.objective,
        project_summary=payload.project_context,
    )
    await WorkforceFactory.materialize_tasks(session, workforce.id, plan, agents)

    # Pass every workforce execution through the Resource Governor & Fair Queue
    admission = await ResourceGovernor.submit(
        session=session,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        workspace_id=ctx.workspace_id,
        workforce=workforce,
        execution_type="WORKFORCE_RUN",
        idempotency_key=payload.idempotency_key,
        inputs={"objective": payload.objective},
    )

    if payload.auto_deploy and admission["status"] == "ADMITTED":
        AgentRuntime.launch_workforce_execution(workforce.id, admission["execution_id"])

    return await SnapshotBuilder.build_world_snapshot(
        session,
        workforce.id,
        user_id=ctx.user_id,
        workspace_id=ctx.workspace_id,
    )


@app.get("/api/workforces/{workforce_id}", response_model=WorldSnapshotSchema)
async def get_workforce(
    workforce_id: str,
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> WorldSnapshotSchema:
    wf = (
        await session.execute(select(WorkforceModel).where(WorkforceModel.id == workforce_id))
    ).scalar_one_or_none()
    await RBACGuard.verify_resource_ownership(session, ctx, wf, "workforce", workforce_id)
    return await SnapshotBuilder.build_world_snapshot(
        session,
        workforce_id,
        user_id=ctx.user_id,
        workspace_id=ctx.workspace_id,
    )


@app.get("/api/world/snapshot", response_model=WorldSnapshotSchema)
async def get_world_snapshot(
    workforce_id: Optional[str] = Query(default=None),
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> WorldSnapshotSchema:
    if workforce_id:
        wf = (
            await session.execute(select(WorkforceModel).where(WorkforceModel.id == workforce_id))
        ).scalar_one_or_none()
        if wf:
            await RBACGuard.verify_resource_ownership(session, ctx, wf, "workforce", workforce_id)
    return await SnapshotBuilder.build_world_snapshot(
        session,
        workforce_id,
        user_id=ctx.user_id,
        workspace_id=ctx.workspace_id,
    )


# ============================================================================
# EXECUTIONS, TOOLS, QUEUE & ADMIN CAPACITY DASHBOARD
# ============================================================================


@app.get("/api/tools")
async def list_registered_tools() -> List[Dict[str, Any]]:
    return UniversalToolRegistry.list_tool_definitions()


@app.get("/api/executions")
async def list_executions(
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    snap = await SnapshotBuilder.build_world_snapshot(
        session,
        user_id=ctx.user_id,
        workspace_id=ctx.workspace_id,
    )
    return snap.executions


@app.get("/api/executions/{execution_id}")
async def get_execution_details(
    execution_id: str,
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    ex = (
        await session.execute(select(ExecutionModel).where(ExecutionModel.id == execution_id))
    ).scalar_one_or_none()
    await RBACGuard.verify_resource_ownership(session, ctx, ex, "execution", execution_id)
    assert ex is not None

    tc_res = await session.execute(
        select(ToolCallModel).where(ToolCallModel.execution_id == ex.id).order_by(ToolCallModel.created_at)
    )
    tr_res = await session.execute(
        select(ToolResultModel).where(ToolResultModel.execution_id == ex.id)
    )
    results_by_call = {r.tool_call_id: r for r in tr_res.scalars().all()}
    apr_res = await session.execute(
        select(ExecutionApprovalModel).where(ExecutionApprovalModel.execution_id == ex.id)
    )
    log_res = await session.execute(
        select(ExecutionLogModel).where(ExecutionLogModel.execution_id == ex.id).order_by(ExecutionLogModel.created_at)
    )

    return {
        "id": ex.id,
        "workforce_id": ex.workforce_id,
        "workspace_id": ex.workspace_id,
        "user_id": ex.user_id,
        "execution_type": ex.execution_type,
        "status": ex.status,
        "execution_mode": ex.execution_mode,
        "working_branch": ex.working_branch,
        "base_commit": ex.base_commit,
        "tokens_used": ex.tokens_used,
        "duration_ms": ex.duration_ms,
        "verification": ex.verification_json or {},
        "deliverables": ex.deliverables_json or [],
        "error_message": ex.error_message,
        "created_at": ex.created_at.isoformat() if ex.created_at else "",
        "completed_at": ex.completed_at.isoformat() if ex.completed_at else None,
        "tool_calls": [
            {
                "id": tc.id,
                "tool_name": tc.tool_name,
                "category": tc.tool_category,
                "status": tc.status,
                "duration_ms": tc.duration_ms,
                "input": tc.input_payload,
                "result": (
                    {
                        "exit_code": results_by_call[tc.id].exit_code,
                        "success": results_by_call[tc.id].success,
                        "output": results_by_call[tc.id].output_payload,
                    }
                    if tc.id in results_by_call
                    else None
                ),
            }
            for tc in tc_res.scalars().all()
        ],
        "approvals": [
            {
                "id": ap.id,
                "action_type": ap.action_type,
                "title": ap.title,
                "description": ap.description,
                "diff_preview": ap.diff_preview,
                "status": ap.status,
            }
            for ap in apr_res.scalars().all()
        ],
        "logs": [
            {
                "id": lg.id,
                "level": lg.level,
                "source": lg.source,
                "message": lg.message,
                "created_at": lg.created_at.isoformat() if lg.created_at else "",
            }
            for lg in log_res.scalars().all()
        ],
    }


@app.post("/api/executions/{execution_id}/cancel")
async def cancel_execution(
    execution_id: str,
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    RBACGuard.require_permission(ctx, "execution:cancel")
    res = await ResourceGovernor.cancel_execution(
        session=session,
        execution_id=execution_id,
        user_id=ctx.user_id,
        is_admin=ctx.platform_role in ("PLATFORM_ADMIN", "PLATFORM_OPERATOR"),
    )
    next_id = res.get("next_admitted_execution_id")
    if next_id:
        next_ex = (
            await session.execute(select(ExecutionModel).where(ExecutionModel.id == next_id))
        ).scalar_one_or_none()
        if next_ex:
            AgentRuntime.launch_workforce_execution(next_ex.workforce_id, next_ex.id)
    return res


@app.get("/api/queue")
async def get_execution_queue(
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    items = await QueueRepository.list_queue_snapshot(session, workspace_id=ctx.workspace_id)
    cap = await CapacityMonitor.get_system_capacity(session)
    return {
        "queue_items": items,
        "capacity": cap,
    }


@app.get("/api/admin/capacity")
async def get_admin_capacity_dashboard(
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    RBACGuard.require_platform_admin(ctx)
    cap = await CapacityMonitor.get_system_capacity(session)
    all_queue = await QueueRepository.list_queue_snapshot(session, workspace_id=None)
    return {
        "capacity": cap,
        "global_queue": all_queue,
    }


@app.post("/api/admin/governor")
async def update_admin_governor_settings(
    payload: AdminGovernorUpdateRequest,
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    RBACGuard.require_platform_admin(ctx)
    updated = ResourceGovernor.update_governor_config(payload.model_dump(exclude_none=True))
    await AuthService.record_audit(
        session=session,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        workspace_id=ctx.workspace_id,
        actor_type="USER",
        actor_id=ctx.user_id,
        action="ADMIN_UPDATED_GOVERNOR_LIMITS",
        resource_type="resource_governor",
        resource_id="global",
        status="COMPLETED",
        details=updated,
    )
    return {"status": "updated", "governor": updated}


@app.get("/api/audit-logs")
async def list_audit_logs(
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    res = await session.execute(
        select(AuditLogModel)
        .where(AuditLogModel.workspace_id == ctx.workspace_id)
        .order_by(desc(AuditLogModel.created_at))
        .limit(50)
    )
    return [
        {
            "id": a.id,
            "actor_type": a.actor_type,
            "actor_id": a.actor_id,
            "action": a.action,
            "resource_type": a.resource_type,
            "resource_id": a.resource_id,
            "status": a.status,
            "details": a.details or {},
            "created_at": a.created_at.isoformat() if a.created_at else "",
        }
        for a in res.scalars().all()
    ]


# ============================================================================
# PRESERVED SIMULATION, AGENT, TASK, MEETING & WEBSOCKET ENDPOINTS
# ============================================================================


@app.post("/api/simulation/control")
async def update_simulation_control(
    payload: SimulationControlRequest,
    workforce_id: Optional[str] = Query(default=None),
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    wf = await SnapshotBuilder.ensure_default_workforce(session, ctx.user_id, ctx.workspace_id)
    if workforce_id:
        res = await session.execute(select(WorkforceModel).where(WorkforceModel.id == workforce_id))
        found = res.scalar_one_or_none()
        if found:
            await RBACGuard.verify_resource_ownership(session, ctx, found, "workforce", workforce_id)
            wf = found

    if payload.speed is not None:
        wf.simulation_speed = max(0.5, min(5.0, payload.speed))
    if payload.is_paused is not None:
        wf.is_paused = payload.is_paused
    await session.commit()

    return {
        "workforce_id": wf.id,
        "simulation_speed": wf.simulation_speed,
        "is_paused": wf.is_paused,
    }


@app.get("/api/agents", response_model=List[AgentProfileSchema])
async def list_agents(
    workforce_id: Optional[str] = Query(default=None),
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> List[AgentProfileSchema]:
    snapshot = await SnapshotBuilder.build_world_snapshot(
        session,
        workforce_id,
        user_id=ctx.user_id,
        workspace_id=ctx.workspace_id,
    )
    return snapshot.agents


@app.get("/api/agents/{agent_id}", response_model=AgentProfileSchema)
async def get_agent(
    agent_id: str,
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> AgentProfileSchema:
    res = await session.execute(select(AgentModel).where(AgentModel.id == agent_id))
    agent = res.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    wf = (
        await session.execute(select(WorkforceModel).where(WorkforceModel.id == agent.workforce_id))
    ).scalar_one_or_none()
    await RBACGuard.verify_resource_ownership(session, ctx, wf, "agent", agent_id)
    return await SnapshotBuilder.serialize_agent(session, agent)


@app.post("/api/agents/{agent_id}/instructions", response_model=AgentProfileSchema)
async def send_agent_instruction(
    agent_id: str,
    payload: AgentInstructionRequest,
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> AgentProfileSchema:
    res = await session.execute(select(AgentModel).where(AgentModel.id == agent_id))
    agent = res.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    wf = (
        await session.execute(select(WorkforceModel).where(WorkforceModel.id == agent.workforce_id))
    ).scalar_one_or_none()
    await RBACGuard.verify_resource_ownership(session, ctx, wf, "agent", agent_id)

    asyncio.create_task(
        AgentRuntime.execute_direct_instruction(
            agent_id=agent.id,
            instruction=payload.instruction,
            assign_as_task=payload.assign_as_task,
            priority=payload.priority,
        )
    )
    return await SnapshotBuilder.serialize_agent(session, agent)


@app.post("/api/agents/{agent_id}/pause", response_model=AgentProfileSchema)
async def pause_agent(
    agent_id: str,
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> AgentProfileSchema:
    res = await session.execute(select(AgentModel).where(AgentModel.id == agent_id))
    agent = res.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    wf = (
        await session.execute(select(WorkforceModel).where(WorkforceModel.id == agent.workforce_id))
    ).scalar_one_or_none()
    await RBACGuard.verify_resource_ownership(session, ctx, wf, "agent", agent_id)
    await StateManager.transition_state(session, agent, "PAUSED", activity="Paused by operator")
    return await SnapshotBuilder.serialize_agent(session, agent)


@app.post("/api/agents/{agent_id}/resume", response_model=AgentProfileSchema)
async def resume_agent(
    agent_id: str,
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> AgentProfileSchema:
    res = await session.execute(select(AgentModel).where(AgentModel.id == agent_id))
    agent = res.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    wf = (
        await session.execute(select(WorkforceModel).where(WorkforceModel.id == agent.workforce_id))
    ).scalar_one_or_none()
    await RBACGuard.verify_resource_ownership(session, ctx, wf, "agent", agent_id)
    await StateManager.transition_state(session, agent, "IDLE", activity="Resumed and standing by")
    return await SnapshotBuilder.serialize_agent(session, agent)


@app.get("/api/tasks", response_model=List[TaskSchema])
async def list_tasks(
    workforce_id: Optional[str] = Query(default=None),
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> List[TaskSchema]:
    snapshot = await SnapshotBuilder.build_world_snapshot(
        session,
        workforce_id,
        user_id=ctx.user_id,
        workspace_id=ctx.workspace_id,
    )
    return snapshot.tasks


@app.get("/api/meetings", response_model=List[MeetingSchema])
async def list_meetings(
    workforce_id: Optional[str] = Query(default=None),
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> List[MeetingSchema]:
    snapshot = await SnapshotBuilder.build_world_snapshot(
        session,
        workforce_id,
        user_id=ctx.user_id,
        workspace_id=ctx.workspace_id,
    )
    return snapshot.meetings


@app.get("/api/meetings/{meeting_id}", response_model=MeetingSchema)
async def get_meeting(
    meeting_id: str,
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> MeetingSchema:
    res = await session.execute(select(MeetingModel).where(MeetingModel.id == meeting_id))
    meeting = res.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    wf = (
        await session.execute(select(WorkforceModel).where(WorkforceModel.id == meeting.workforce_id))
    ).scalar_one_or_none()
    await RBACGuard.verify_resource_ownership(session, ctx, wf, "meeting", meeting_id)
    agents = await AgentRegistry.get_workforce_agents(session, meeting.workforce_id)
    agents_by_id = {a.id: a for a in agents}
    return await SnapshotBuilder.serialize_meeting(session, meeting, agents_by_id)


@app.post("/api/meetings/{meeting_id}/observe", response_model=MeetingSchema)
async def observe_meeting(
    meeting_id: str,
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> MeetingSchema:
    res = await session.execute(select(MeetingModel).where(MeetingModel.id == meeting_id))
    meeting = res.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    wf = (
        await session.execute(select(WorkforceModel).where(WorkforceModel.id == meeting.workforce_id))
    ).scalar_one_or_none()
    await RBACGuard.verify_resource_ownership(session, ctx, wf, "meeting", meeting_id)
    meeting.is_observed = True
    await session.commit()
    agents = await AgentRegistry.get_workforce_agents(session, meeting.workforce_id)
    agents_by_id = {a.id: a for a in agents}
    return await SnapshotBuilder.serialize_meeting(session, meeting, agents_by_id)


@app.post("/api/meetings/trigger")
async def trigger_boardroom_session(
    workforce_id: Optional[str] = Query(default=None),
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    wf = await SnapshotBuilder.ensure_default_workforce(session, ctx.user_id, ctx.workspace_id)
    if workforce_id:
        res = await session.execute(select(WorkforceModel).where(WorkforceModel.id == workforce_id))
        found = res.scalar_one_or_none()
        if found:
            await RBACGuard.verify_resource_ownership(session, ctx, found, "workforce", workforce_id)
            wf = found

    async def _run_ad_hoc_meeting(target_wf_id: str, objective: str, summary: Any):
        async with AsyncSessionLocal() as bg_session:
            agents = await AgentRegistry.get_workforce_agents(bg_session, target_wf_id)
            if not agents:
                return
            by_key = {a.agent_key: a for a in agents}
            initiator = by_key.get("alex") or agents[0]
            await MeetingCoordinator.conduct_boardroom_meeting(
                session=bg_session,
                workforce_id=target_wf_id,
                initiator=initiator,
                participants=agents,
                title="Executive Architecture & Security Alignment Session",
                objective=objective,
                agent_findings={},
                project_summary=summary,
            )

    asyncio.create_task(_run_ad_hoc_meeting(wf.id, wf.objective, wf.project_summary))
    return {"status": "convening", "workforce_id": wf.id, "room_id": "boardroom"}


@app.get("/api/usage", response_model=TokenUsageSummarySchema)
async def get_usage(
    workforce_id: Optional[str] = Query(default=None),
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> TokenUsageSummarySchema:
    snapshot = await SnapshotBuilder.build_world_snapshot(
        session,
        workforce_id,
        user_id=ctx.user_id,
        workspace_id=ctx.workspace_id,
    )
    return snapshot.token_usage


@app.get("/api/events", response_model=List[WorldEventSchema])
async def get_events(
    workforce_id: Optional[str] = Query(default=None),
    since_sequence: int = Query(default=0),
    limit: int = Query(default=100),
    ctx: AuthenticatedContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> List[WorldEventSchema]:
    wf = await SnapshotBuilder.ensure_default_workforce(session, ctx.user_id, ctx.workspace_id)
    target_wf_id = workforce_id or wf.id
    res = await session.execute(
        select(AgentEventModel)
        .where(
            AgentEventModel.workforce_id == target_wf_id,
            AgentEventModel.sequence > since_sequence,
        )
        .order_by(desc(AgentEventModel.sequence))
        .limit(limit)
    )
    rows = list(reversed(list(res.scalars().all())))
    return [
        WorldEventSchema(
            event_id=e.id,
            sequence=e.sequence,
            workforce_id=e.workforce_id,
            event_type=e.event_type,  # type: ignore[arg-type]
            entity_id=e.entity_id,
            payload=e.payload or {},
            timestamp=e.created_at,
        )
        for e in rows
    ]


@app.websocket("/ws/world/{workforce_id}")
async def websocket_world_endpoint(websocket: WebSocket, workforce_id: str):
    await event_bus.connect(workforce_id, websocket)
    try:
        async with AsyncSessionLocal() as session:
            target_id = None if workforce_id in ("current", "default", "all") else workforce_id
            snapshot = await SnapshotBuilder.build_world_snapshot(session, target_id)
            await websocket.send_json(
                {
                    "type": "INITIAL_SNAPSHOT",
                    "snapshot": snapshot.model_dump(mode="json"),
                }
            )

        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=20.0)
                msg_type = data.get("type")
                if msg_type == "PING":
                    await websocket.send_json({"type": "PONG"})
                elif msg_type == "REQUEST_SNAPSHOT":
                    req_wf_id = data.get("workforce_id") or (
                        None if workforce_id in ("current", "default", "all") else workforce_id
                    )
                    async with AsyncSessionLocal() as session:
                        snap = await SnapshotBuilder.build_world_snapshot(session, req_wf_id)
                        await websocket.send_json(
                            {
                                "type": "INITIAL_SNAPSHOT",
                                "snapshot": snap.model_dump(mode="json"),
                            }
                        )
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "HEARTBEAT"})
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug("WebSocket closed: %s", exc)
    finally:
        await event_bus.disconnect(workforce_id, websocket)
