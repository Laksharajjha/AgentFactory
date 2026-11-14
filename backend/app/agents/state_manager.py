import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.event_bus import event_bus
from app.models import AgentModel
from app.schemas import AgentStateLiteral
from app.world.layout import ROOM_MAP

ALLOWED_TRANSITIONS: Dict[str, Set[str]] = {
    "IDLE": {"TASK_ASSIGNED", "PLANNING", "MOVING", "IN_MEETING", "PAUSED", "WORKING"},
    "TASK_ASSIGNED": {"PLANNING", "MOVING", "WORKING", "WAITING", "PAUSED", "FAILED", "IDLE"},
    "PLANNING": {"WORKING", "MOVING", "NEEDS_COLLABORATION", "IN_MEETING", "COMPLETED", "FAILED", "PAUSED", "IDLE"},
    "WORKING": {"NEEDS_COLLABORATION", "MOVING", "IN_MEETING", "PRESENTING", "WAITING", "COMPLETED", "FAILED", "PAUSED", "IDLE"},
    "NEEDS_COLLABORATION": {"MOVING", "IN_MEETING", "WORKING", "WAITING", "PAUSED", "FAILED", "IDLE", "TASK_ASSIGNED"},
    "MOVING": {"WORKING", "IN_MEETING", "PRESENTING", "PLANNING", "IDLE", "COMPLETED", "PAUSED", "FAILED", "TASK_ASSIGNED", "NEEDS_COLLABORATION"},
    "IN_MEETING": {"PRESENTING", "IN_MEETING", "MOVING", "WORKING", "COMPLETED", "IDLE", "PAUSED", "TASK_ASSIGNED"},
    "PRESENTING": {"IN_MEETING", "MOVING", "WORKING", "COMPLETED", "IDLE", "PAUSED", "TASK_ASSIGNED"},
    "WAITING": {"WORKING", "MOVING", "IN_MEETING", "COMPLETED", "FAILED", "PAUSED", "IDLE"},
    "COMPLETED": {"IDLE", "TASK_ASSIGNED", "MOVING", "IN_MEETING", "WORKING", "PAUSED"},
    "FAILED": {"IDLE", "TASK_ASSIGNED", "PLANNING", "WORKING", "PAUSED"},
    "PAUSED": {"IDLE", "TASK_ASSIGNED", "PLANNING", "WORKING", "MOVING", "IN_MEETING"},
}


class InvalidStateTransitionError(Exception):
    pass


class StateManager:
    """Validates and executes agent state transitions and physical room movements."""

    @staticmethod
    def validate_transition(current_state: str, next_state: str) -> bool:
        if current_state == next_state:
            return True
        allowed = ALLOWED_TRANSITIONS.get(current_state, set())
        return next_state in allowed

    @staticmethod
    async def transition_state(
        session: AsyncSession,
        agent: AgentModel,
        new_state: AgentStateLiteral,
        activity: Optional[str] = None,
        error_msg: Optional[str] = None,
    ) -> AgentModel:
        old_state = agent.state
        if not StateManager.validate_transition(old_state, new_state):
            raise InvalidStateTransitionError(
                f"Invalid agent state transition for {agent.name}: {old_state} -> {new_state}"
            )

        agent.state = new_state
        if activity:
            agent.current_activity = activity
        if error_msg is not None:
            agent.recent_error = error_msg
        agent.state_changed_at = datetime.now(timezone.utc)
        await session.commit()

        await event_bus.emit(
            session=session,
            workforce_id=agent.workforce_id,
            event_type="AGENT_STATE_CHANGED",
            entity_id=agent.id,
            payload={
                "agent_id": agent.id,
                "agent_key": agent.agent_key,
                "agent_name": agent.name,
                "previous_state": old_state,
                "new_state": new_state,
                "current_activity": agent.current_activity,
                "room_id": agent.current_room_id,
                "recent_error": agent.recent_error,
            },
        )
        return agent

    @staticmethod
    async def move_agent_to_room(
        session: AsyncSession,
        agent: AgentModel,
        target_room_id: str,
        target_coords: Optional[List[float]] = None,
        activity_label: Optional[str] = None,
        travel_delay: float = 1.4,
    ) -> AgentModel:
        room = ROOM_MAP.get(target_room_id)
        if not room:
            return agent

        dest = target_coords or room["workstation"]
        from_room = agent.current_room_id
        from_pos = [agent.position_x, agent.position_y, agent.position_z]

        agent.target_room_id = target_room_id
        agent.target_x, agent.target_y, agent.target_z = dest[0], dest[1], dest[2]
        agent.state = "MOVING"
        agent.current_activity = activity_label or f"Walking to {room['name']}"
        agent.state_changed_at = datetime.now(timezone.utc)
        await session.commit()

        await event_bus.emit(
            session=session,
            workforce_id=agent.workforce_id,
            event_type="AGENT_MOVEMENT_REQUESTED",
            entity_id=agent.id,
            payload={
                "agent_id": agent.id,
                "agent_key": agent.agent_key,
                "agent_name": agent.name,
                "from_room_id": from_room,
                "to_room_id": target_room_id,
                "to_room_name": room["name"],
                "from_position": from_pos,
                "target_position": dest,
                "activity": agent.current_activity,
            },
        )

        if travel_delay > 0:
            await asyncio.sleep(travel_delay)

        agent.current_room_id = target_room_id
        agent.position_x, agent.position_y, agent.position_z = dest[0], dest[1], dest[2]
        agent.target_room_id = None
        agent.target_x = None
        agent.target_y = None
        agent.target_z = None
        await session.commit()

        await event_bus.emit(
            session=session,
            workforce_id=agent.workforce_id,
            event_type="AGENT_LOCATION_CHANGED",
            entity_id=agent.id,
            payload={
                "agent_id": agent.id,
                "agent_key": agent.agent_key,
                "agent_name": agent.name,
                "room_id": target_room_id,
                "room_name": room["name"],
                "position": dest,
            },
        )
        return agent
