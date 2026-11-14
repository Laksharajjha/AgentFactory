import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import select

from app.agents.agent_memory import AgentMemoryManager
from app.agents.state_manager import StateManager
from app.agents.task_executor import TaskExecutor
from app.database import AsyncSessionLocal
from app.events.event_bus import event_bus
from app.meetings.meeting_coordinator import MeetingCoordinator
from app.models import AgentModel, TaskModel, WorkforceModel

logger = logging.getLogger("project_forge.runtime")


class AgentRuntime:
    """Master asynchronous execution engine driving the AI workforce lifecycle."""

    _active_jobs: Dict[str, asyncio.Task] = {}

    @classmethod
    def launch_workforce_execution(cls, workforce_id: str) -> None:
        if workforce_id in cls._active_jobs and not cls._active_jobs[workforce_id].done():
            return
        task = asyncio.create_task(cls._run_workforce_pipeline(workforce_id))
        cls._active_jobs[workforce_id] = task

    @classmethod
    async def _run_workforce_pipeline(cls, workforce_id: str) -> None:
        try:
            async with AsyncSessionLocal() as session:
                wf_res = await session.execute(
                    select(WorkforceModel).where(WorkforceModel.id == workforce_id)
                )
                workforce = wf_res.scalar_one_or_none()
                if not workforce:
                    return

                workforce.status = "RUNNING"
                await session.commit()

                ag_res = await session.execute(
                    select(AgentModel).where(AgentModel.workforce_id == workforce_id)
                )
                agents = list(ag_res.scalars().all())
                agent_by_key = {a.agent_key: a for a in agents}
                agent_by_id = {a.id: a for a in agents}

                tsk_res = await session.execute(
                    select(TaskModel).where(TaskModel.workforce_id == workforce_id)
                )
                tasks = list(tsk_res.scalars().all())

                alex = agent_by_key.get("alex") or agents[0]

                # Step 1: Alex receives the request in the CEO Office and orchestrates initial dispatch
                if alex:
                    await StateManager.move_agent_to_room(
                        session=session,
                        agent=alex,
                        target_room_id="ceo_office",
                        activity_label="Reviewing incoming project brief in CEO Office",
                        travel_delay=0.4,
                    )

                exec_tasks = [t for t in tasks if t.assigned_agent_id == alex.id]
                specialist_tasks = [t for t in tasks if t.assigned_agent_id != alex.id]

                agent_findings: Dict[str, Any] = {}

                # Execute Alex's intake task first
                for etask in exec_tasks:
                    out = await TaskExecutor.execute_task(
                        session=session,
                        agent=alex,
                        task=etask,
                        objective=workforce.objective,
                        project_summary=workforce.project_summary,
                    )
                    if out:
                        agent_findings[alex.agent_key] = out.model_dump()

                # Alex dispatches structured messages to specialist employees
                for stask in specialist_tasks:
                    recipient = agent_by_id.get(stask.assigned_agent_id or "")
                    if recipient and alex:
                        await event_bus.emit(
                            session=session,
                            workforce_id=workforce_id,
                            event_type="AGENT_MESSAGE_CREATED",
                            entity_id=alex.id,
                            payload={
                                "sender_id": alex.id,
                                "sender_name": alex.name,
                                "recipient_id": recipient.id,
                                "recipient_name": recipient.name,
                                "message_type": "TASK_ASSIGNMENT",
                                "task_id": stask.id,
                                "content": f"Alex -> {recipient.name}: Execute '{stask.title}' and report findings for boardroom synthesis.",
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            },
                        )

                # Step 2: Specialist agents move to their labs/rooms (Architecture Lab, QA Lab, Security Room, etc.) and execute
                for stask in specialist_tasks:
                    recipient = agent_by_id.get(stask.assigned_agent_id or "")
                    if not recipient:
                        continue
                    out = await TaskExecutor.execute_task(
                        session=session,
                        agent=recipient,
                        task=stask,
                        objective=workforce.objective,
                        project_summary=workforce.project_summary,
                    )
                    if out:
                        agent_findings[recipient.agent_key] = out.model_dump()

                # Step 3: Detect collaboration requirement & convene Boardroom Meeting
                meeting_participants: List[AgentModel] = []
                for key in ["alex", "olivia", "marcus", "sarah", "nina", "daniel"]:
                    if key in agent_by_key:
                        meeting_participants.append(agent_by_key[key])

                meeting = await MeetingCoordinator.conduct_boardroom_meeting(
                    session=session,
                    workforce_id=workforce_id,
                    initiator=alex,
                    participants=meeting_participants,
                    title="Architecture, Security & Refactoring Strategy Boardroom Review",
                    objective=workforce.objective,
                    agent_findings=agent_findings,
                    project_summary=workforce.project_summary,
                )

                # Step 4: Compile Final Executive Report & Complete Workforce
                final_report = {
                    "title": f"Executive Refactoring & Architecture Dossier — {workforce.name}",
                    "objective": workforce.objective,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "meeting_id": meeting.id,
                    "executive_summary": (
                        "All 6 specialized AI employees completed domain inspections, convened in the Main Boardroom, "
                        "challenged architectural and security assumptions, and ratified a 3-stage strangler-fig refactoring strategy."
                    ),
                    "agent_contributions": agent_findings,
                    "key_deliverables": [
                        "Target Hexagonal Service Topology Diagram (Marcus)",
                        "v2 Zero-Trust JWT & Raw-Body HMAC Middleware Specification (Sarah)",
                        "Golden API Contract Snapshot & Regression Baseline Suite (Nina)",
                        "Risk-Adjusted 3-Phase Rollout & Canary Charter (Olivia & Alex)",
                        "Sequenced WebSocket Store Reconciliation Contract (Daniel)",
                    ],
                }
                workforce.final_report = final_report
                workforce.status = "COMPLETED"
                await session.commit()

                for ag in agents:
                    if ag.state not in ("IDLE", "PAUSED"):
                        ag.state = "IDLE"
                        ag.current_activity = f"Ready in {ag.current_room_id.replace('_', ' ').title()} — Project Complete"
                        ag.current_task_id = None
                await session.commit()

                await event_bus.emit(
                    session=session,
                    workforce_id=workforce_id,
                    event_type="WORKFORCE_COMPLETED",
                    entity_id=workforce.id,
                    payload={
                        "workforce_id": workforce.id,
                        "workforce_name": workforce.name,
                        "status": "COMPLETED",
                        "tokens_used": workforce.tokens_used,
                        "llm_calls_made": workforce.llm_calls_made,
                        "final_report": final_report,
                    },
                )

        except Exception as exc:
            logger.exception("Workforce pipeline failed for %s: %s", workforce_id, exc)
            async with AsyncSessionLocal() as session:
                wf_res = await session.execute(
                    select(WorkforceModel).where(WorkforceModel.id == workforce_id)
                )
                workforce = wf_res.scalar_one_or_none()
                if workforce:
                    workforce.status = "FAILED"
                    await session.commit()

    @classmethod
    async def execute_direct_instruction(
        cls,
        agent_id: str,
        instruction: str,
        assign_as_task: bool = True,
        priority: str = "HIGH",
    ) -> None:
        async with AsyncSessionLocal() as session:
            ag_res = await session.execute(
                select(AgentModel).where(AgentModel.id == agent_id)
            )
            agent = ag_res.scalar_one_or_none()
            if not agent:
                return

            wf_res = await session.execute(
                select(WorkforceModel).where(WorkforceModel.id == agent.workforce_id)
            )
            workforce = wf_res.scalar_one_or_none()
            if not workforce:
                return

            await AgentMemoryManager.add_memory(
                session=session,
                agent_id=agent.id,
                workforce_id=workforce.id,
                content=f"Received direct user instruction: {instruction}",
                memory_type="INSTRUCTION",
                importance=0.95,
            )

            if assign_as_task:
                import uuid
                new_task = TaskModel(
                    id=f"tsk_{uuid.uuid4().hex[:8]}",
                    workforce_id=workforce.id,
                    title=f"Direct Directive: {instruction[:55]}",
                    description=instruction,
                    assigned_agent_id=agent.id,
                    priority=priority,
                    status="PENDING",
                    progress=0,
                    target_room_id=agent.home_room_id,
                    deliverables=["Executive Response & Technical Action Artifact"],
                )
                session.add(new_task)
                await session.commit()

                await event_bus.emit(
                    session=session,
                    workforce_id=workforce.id,
                    event_type="TASK_CREATED",
                    entity_id=new_task.id,
                    payload={
                        "task_id": new_task.id,
                        "title": new_task.title,
                        "description": new_task.description,
                        "assigned_agent_id": agent.id,
                        "assigned_agent_name": agent.name,
                        "priority": new_task.priority,
                        "status": new_task.status,
                    },
                )

                await TaskExecutor.execute_task(
                    session=session,
                    agent=agent,
                    task=new_task,
                    objective=instruction,
                    project_summary=workforce.project_summary,
                )
                await StateManager.transition_state(
                    session=session,
                    agent=agent,
                    new_state="IDLE",
                    activity=f"Completed directive: {instruction[:45]}",
                )
