import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.agent_memory import AgentMemoryManager
from app.events.event_bus import event_bus
from app.models import AgentModel, WorkforceModel
from app.world.layout import INITIAL_EMPLOYEES, ROOM_MAP


class AgentRegistry:
    """Manages AI employees across workforces and ensures default office occupancy."""

    @staticmethod
    async def create_workforce_agents(
        session: AsyncSession,
        workforce: WorkforceModel,
        custom_blueprints: Optional[List[Dict[str, Any]]] = None,
        emit_events: bool = True,
    ) -> List[AgentModel]:
        blueprints = custom_blueprints or INITIAL_EMPLOYEES
        created_agents: List[AgentModel] = []

        for bp in blueprints:
            home_room_id = bp.get("home_room_id", "ceo_office")
            room = ROOM_MAP.get(home_room_id, ROOM_MAP["ceo_office"])
            workstation = room["workstation"]

            agent_id = f"agt_{workforce.id[-6:]}_{bp['agent_key']}"
            existing = await session.execute(
                select(AgentModel).where(AgentModel.id == agent_id)
            )
            if existing.scalar_one_or_none():
                continue

            agent = AgentModel(
                id=agent_id,
                workforce_id=workforce.id,
                workspace_id=workforce.workspace_id,
                agent_key=bp["agent_key"],
                name=bp["name"],
                role=bp["role"],
                department=bp["department"],
                personality=bp["personality"],
                system_instructions=bp["system_instructions"],
                capabilities=bp.get("capabilities", []),
                tools=bp.get("tools", []),
                memory_enabled=True,
                state="IDLE",
                current_activity=f"Stationed in {room['name']}",
                current_room_id=home_room_id,
                home_room_id=home_room_id,
                position_x=workstation[0],
                position_y=workstation[1],
                position_z=workstation[2],
                avatar_config=bp.get("avatar_config", {}),
                max_iterations=bp.get("max_iterations", 5),
                iterations_used=0,
                token_budget=bp.get("token_budget", 15000),
                tokens_used=0,
                tasks_completed=0,
                tasks_failed=0,
                meetings_attended=0,
            )
            session.add(agent)
            created_agents.append(agent)

        await session.commit()

        for agent in created_agents:
            await AgentMemoryManager.add_memory(
                session=session,
                agent_id=agent.id,
                workforce_id=workforce.id,
                content=f"Initialized in {ROOM_MAP[agent.home_room_id]['name']} as {agent.role}. Ready for assignment on '{workforce.name}'.",
                memory_type="OBSERVATION",
                importance=0.75,
            )
            if emit_events:
                await event_bus.emit(
                    session=session,
                    workforce_id=workforce.id,
                    event_type="AGENT_CREATED",
                    entity_id=agent.id,
                    payload={
                        "agent_id": agent.id,
                        "agent_key": agent.agent_key,
                        "name": agent.name,
                        "role": agent.role,
                        "department": agent.department,
                        "room_id": agent.current_room_id,
                        "position": [agent.position_x, agent.position_y, agent.position_z],
                    },
                )

        return created_agents

    @staticmethod
    async def get_workforce_agents(session: AsyncSession, workforce_id: str) -> List[AgentModel]:
        res = await session.execute(
            select(AgentModel).where(AgentModel.workforce_id == workforce_id)
        )
        return list(res.scalars().all())
