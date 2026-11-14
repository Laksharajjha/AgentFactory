import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.agent_memory import AgentMemoryManager
from app.agents.base_agent import AgentTaskAnalysisOutput, BaseAgent
from app.agents.state_manager import StateManager
from app.events.event_bus import event_bus
from app.models import AgentModel, TaskModel
from app.world.layout import ROOM_MAP


class TaskExecutor:
    """Executes assigned agent tasks with physical room navigation, LLM analysis, and event telemetry."""

    @staticmethod
    async def execute_task(
        session: AsyncSession,
        agent: AgentModel,
        task: TaskModel,
        objective: str,
        project_summary: Optional[Dict[str, Any]] = None,
    ) -> Optional[AgentTaskAnalysisOutput]:
        # Wait if agent is paused
        for _ in range(30):
            if agent.state != "PAUSED":
                break
            await asyncio.sleep(0.5)

        target_room_id = task.target_room_id or agent.home_room_id
        target_room = ROOM_MAP.get(target_room_id, ROOM_MAP[agent.home_room_id])

        task.status = "IN_PROGRESS"
        task.progress = 15
        agent.current_task_id = task.id
        history = list(task.execution_history or [])
        history.append(
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "event": "TASK_ASSIGNED",
                "agent": agent.name,
                "room": target_room["name"],
            }
        )
        task.execution_history = history
        await session.commit()

        await StateManager.transition_state(
            session=session,
            agent=agent,
            new_state="TASK_ASSIGNED",
            activity=f"Assigned: {task.title}",
        )

        await event_bus.emit(
            session=session,
            workforce_id=agent.workforce_id,
            event_type="AGENT_TASK_ASSIGNED",
            entity_id=agent.id,
            payload={
                "agent_id": agent.id,
                "agent_name": agent.name,
                "task_id": task.id,
                "task_title": task.title,
                "target_room_id": target_room_id,
            },
        )

        # Physically walk to the target room if not already at its workstation
        if agent.current_room_id != target_room_id:
            await StateManager.move_agent_to_room(
                session=session,
                agent=agent,
                target_room_id=target_room_id,
                target_coords=target_room["workstation"],
                activity_label=f"Walking to {target_room['name']} for {task.title}",
                travel_delay=1.6,
            )

        await StateManager.transition_state(
            session=session,
            agent=agent,
            new_state="PLANNING",
            activity=f"Planning execution: {task.title}",
        )
        task.progress = 35
        await session.commit()
        await asyncio.sleep(0.5)

        await StateManager.transition_state(
            session=session,
            agent=agent,
            new_state="WORKING",
            activity=f"Executing: {task.title}",
        )
        task.progress = 60
        await session.commit()

        await event_bus.emit(
            session=session,
            workforce_id=agent.workforce_id,
            event_type="AGENT_WORK_STARTED",
            entity_id=agent.id,
            payload={
                "agent_id": agent.id,
                "agent_name": agent.name,
                "task_id": task.id,
                "task_title": task.title,
                "room_id": agent.current_room_id,
            },
        )

        try:
            base_agent = BaseAgent(agent)
            analysis_output, telemetry = await base_agent.execute_task_step(
                session=session,
                task=task,
                objective=objective,
                project_summary=project_summary,
            )

            task.status = "COMPLETED"
            task.progress = 100
            task.result_summary = analysis_output.executive_summary
            task.structured_output = analysis_output.model_dump()
            task.completed_at = datetime.now(timezone.utc)
            history = list(task.execution_history or [])
            history.append(
                {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "event": "TASK_COMPLETED",
                    "summary": analysis_output.executive_summary,
                    "tokens_used": telemetry.get("total_tokens", 0),
                }
            )
            task.execution_history = history

            agent.tasks_completed = (agent.tasks_completed or 0) + 1
            await session.commit()

            if analysis_output.requires_collaboration:
                await StateManager.transition_state(
                    session=session,
                    agent=agent,
                    new_state="NEEDS_COLLABORATION",
                    activity=f"Requesting collaboration: {analysis_output.collaboration_topic}",
                )
            else:
                await StateManager.transition_state(
                    session=session,
                    agent=agent,
                    new_state="COMPLETED",
                    activity=f"Finished: {task.title}",
                )

            await event_bus.emit(
                session=session,
                workforce_id=agent.workforce_id,
                event_type="AGENT_WORK_COMPLETED",
                entity_id=agent.id,
                payload={
                    "agent_id": agent.id,
                    "agent_name": agent.name,
                    "task_id": task.id,
                    "task_title": task.title,
                    "summary": analysis_output.executive_summary,
                },
            )

            await event_bus.emit(
                session=session,
                workforce_id=agent.workforce_id,
                event_type="TASK_COMPLETED",
                entity_id=task.id,
                payload={
                    "task_id": task.id,
                    "title": task.title,
                    "assigned_agent_id": agent.id,
                    "assigned_agent_name": agent.name,
                    "result_summary": analysis_output.executive_summary,
                    "structured_output": analysis_output.model_dump(),
                },
            )

            return analysis_output

        except Exception as exc:
            err_text = str(exc)
            task.status = "FAILED"
            history = list(task.execution_history or [])
            history.append(
                {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "event": "TASK_FAILED",
                    "error": err_text,
                }
            )
            task.execution_history = history
            agent.tasks_failed = (agent.tasks_failed or 0) + 1
            agent.recent_error = err_text
            await session.commit()

            await StateManager.transition_state(
                session=session,
                agent=agent,
                new_state="FAILED",
                activity=f"Task failed: {task.title}",
                error_msg=err_text,
            )

            await AgentMemoryManager.add_memory(
                session=session,
                agent_id=agent.id,
                workforce_id=agent.workforce_id,
                content=f"Task '{task.title}' failed with error: {err_text}",
                memory_type="OBSERVATION",
                importance=0.95,
            )

            await event_bus.emit(
                session=session,
                workforce_id=agent.workforce_id,
                event_type="TASK_FAILED",
                entity_id=task.id,
                payload={
                    "task_id": task.id,
                    "title": task.title,
                    "assigned_agent_id": agent.id,
                    "assigned_agent_name": agent.name,
                    "error": err_text,
                },
            )
            return None
