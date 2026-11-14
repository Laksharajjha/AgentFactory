import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.agent_registry import AgentRegistry
from app.agents.agent_runtime import AgentRuntime
from app.agents.state_manager import StateManager
from app.config import settings
from app.database import AsyncSessionLocal, get_db, init_db
from app.events.event_bus import event_bus
from app.factory.workforce_factory import WorkforceFactory
from app.factory.zip_analyzer import ZipAnalyzer
from app.llm.gemini_provider import gemini_provider
from app.meetings.meeting_coordinator import MeetingCoordinator
from app.models import AgentEventModel, AgentModel, MeetingModel, WorkforceModel
from app.schemas import (
    AgentInstructionRequest,
    AgentProfileSchema,
    LLMConfigUpdateRequest,
    MeetingSchema,
    SimulationControlRequest,
    TaskSchema,
    TokenUsageSummarySchema,
    WorkforceCreateRequest,
    WorldEventSchema,
    WorldSnapshotSchema,
)
from app.world.snapshot_builder import SnapshotBuilder

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("project_forge.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    async with AsyncSessionLocal() as session:
        await SnapshotBuilder.ensure_default_workforce(session)
    yield


app = FastAPI(
    title="PROJECT FORGE — Autonomous 3D AI Workforce Engine",
    version="1.0.0",
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
async def health_check() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "PROJECT FORGE Backend",
        "gemini_live_configured": gemini_provider.is_live_configured(),
        "active_model": settings.GEMINI_MODEL,
    }


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
    }


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
        project_context=payload.project_context,
    ) if False else WorkforceFactory.build_workforce_plan(
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
    session: AsyncSession = Depends(get_db),
) -> WorldSnapshotSchema:
    wf_id = f"wf_{uuid.uuid4().hex[:10]}"
    workforce = WorkforceModel(
        id=wf_id,
        user_id="usr_director",
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
    plan = WorkforceFactory.build_workforce_plan(
        objective=payload.objective,
        project_summary=payload.project_context,
    )
    await WorkforceFactory.materialize_tasks(session, workforce.id, plan, agents)

    if payload.auto_deploy:
        AgentRuntime.launch_workforce_execution(workforce.id)

    return await SnapshotBuilder.build_world_snapshot(session, workforce.id)


@app.get("/api/workforces/{workforce_id}", response_model=WorldSnapshotSchema)
async def get_workforce(
    workforce_id: str,
    session: AsyncSession = Depends(get_db),
) -> WorldSnapshotSchema:
    return await SnapshotBuilder.build_world_snapshot(session, workforce_id)


@app.get("/api/world/snapshot", response_model=WorldSnapshotSchema)
async def get_world_snapshot(
    workforce_id: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_db),
) -> WorldSnapshotSchema:
    return await SnapshotBuilder.build_world_snapshot(session, workforce_id)


@app.post("/api/simulation/control")
async def update_simulation_control(
    payload: SimulationControlRequest,
    workforce_id: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    wf = await SnapshotBuilder.ensure_default_workforce(session)
    if workforce_id:
        res = await session.execute(select(WorkforceModel).where(WorkforceModel.id == workforce_id))
        found = res.scalar_one_or_none()
        if found:
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
    session: AsyncSession = Depends(get_db),
) -> List[AgentProfileSchema]:
    snapshot = await SnapshotBuilder.build_world_snapshot(session, workforce_id)
    return snapshot.agents


@app.get("/api/agents/{agent_id}", response_model=AgentProfileSchema)
async def get_agent(
    agent_id: str,
    session: AsyncSession = Depends(get_db),
) -> AgentProfileSchema:
    res = await session.execute(select(AgentModel).where(AgentModel.id == agent_id))
    agent = res.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return await SnapshotBuilder.serialize_agent(session, agent)


@app.post("/api/agents/{agent_id}/instructions", response_model=AgentProfileSchema)
async def send_agent_instruction(
    agent_id: str,
    payload: AgentInstructionRequest,
    session: AsyncSession = Depends(get_db),
) -> AgentProfileSchema:
    res = await session.execute(select(AgentModel).where(AgentModel.id == agent_id))
    agent = res.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

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
    session: AsyncSession = Depends(get_db),
) -> AgentProfileSchema:
    res = await session.execute(select(AgentModel).where(AgentModel.id == agent_id))
    agent = res.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    await StateManager.transition_state(session, agent, "PAUSED", activity="Paused by operator")
    return await SnapshotBuilder.serialize_agent(session, agent)


@app.post("/api/agents/{agent_id}/resume", response_model=AgentProfileSchema)
async def resume_agent(
    agent_id: str,
    session: AsyncSession = Depends(get_db),
) -> AgentProfileSchema:
    res = await session.execute(select(AgentModel).where(AgentModel.id == agent_id))
    agent = res.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    await StateManager.transition_state(session, agent, "IDLE", activity="Resumed and standing by")
    return await SnapshotBuilder.serialize_agent(session, agent)


@app.get("/api/tasks", response_model=List[TaskSchema])
async def list_tasks(
    workforce_id: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_db),
) -> List[TaskSchema]:
    snapshot = await SnapshotBuilder.build_world_snapshot(session, workforce_id)
    return snapshot.tasks


@app.get("/api/meetings", response_model=List[MeetingSchema])
async def list_meetings(
    workforce_id: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_db),
) -> List[MeetingSchema]:
    snapshot = await SnapshotBuilder.build_world_snapshot(session, workforce_id)
    return snapshot.meetings


@app.get("/api/meetings/{meeting_id}", response_model=MeetingSchema)
async def get_meeting(
    meeting_id: str,
    session: AsyncSession = Depends(get_db),
) -> MeetingSchema:
    res = await session.execute(select(MeetingModel).where(MeetingModel.id == meeting_id))
    meeting = res.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    agents = await AgentRegistry.get_workforce_agents(session, meeting.workforce_id)
    agents_by_id = {a.id: a for a in agents}
    return await SnapshotBuilder.serialize_meeting(session, meeting, agents_by_id)


@app.post("/api/meetings/{meeting_id}/observe", response_model=MeetingSchema)
async def observe_meeting(
    meeting_id: str,
    session: AsyncSession = Depends(get_db),
) -> MeetingSchema:
    res = await session.execute(select(MeetingModel).where(MeetingModel.id == meeting_id))
    meeting = res.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    meeting.is_observed = True
    await session.commit()
    agents = await AgentRegistry.get_workforce_agents(session, meeting.workforce_id)
    agents_by_id = {a.id: a for a in agents}
    return await SnapshotBuilder.serialize_meeting(session, meeting, agents_by_id)


@app.post("/api/meetings/trigger")
async def trigger_boardroom_session(
    workforce_id: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    wf = await SnapshotBuilder.ensure_default_workforce(session)
    if workforce_id:
        res = await session.execute(select(WorkforceModel).where(WorkforceModel.id == workforce_id))
        found = res.scalar_one_or_none()
        if found:
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
    session: AsyncSession = Depends(get_db),
) -> TokenUsageSummarySchema:
    snapshot = await SnapshotBuilder.build_world_snapshot(session, workforce_id)
    return snapshot.token_usage


@app.get("/api/events", response_model=List[WorldEventSchema])
async def get_events(
    workforce_id: Optional[str] = Query(default=None),
    since_sequence: int = Query(default=0),
    limit: int = Query(default=100),
    session: AsyncSession = Depends(get_db),
) -> List[WorldEventSchema]:
    wf = await SnapshotBuilder.ensure_default_workforce(session)
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
                    req_wf_id = data.get("workforce_id") or (None if workforce_id in ("current", "default", "all") else workforce_id)
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
