import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AgentMemoryModel


class AgentMemoryManager:
    """Manages persistent agent memories (observations, decisions, summaries, instructions)."""

    @staticmethod
    async def add_memory(
        session: AsyncSession,
        agent_id: str,
        workforce_id: str,
        content: str,
        memory_type: str = "OBSERVATION",
        importance: float = 0.85,
        context_meta: Optional[Dict[str, Any]] = None,
    ) -> AgentMemoryModel:
        mem = AgentMemoryModel(
            id=f"mem_{uuid.uuid4().hex[:10]}",
            agent_id=agent_id,
            workforce_id=workforce_id,
            memory_type=memory_type,
            content=content,
            importance=importance,
            context_meta=context_meta or {},
        )
        session.add(mem)
        await session.commit()
        return mem

    @staticmethod
    async def get_agent_memories(
        session: AsyncSession,
        agent_id: str,
        limit: int = 12,
    ) -> List[AgentMemoryModel]:
        res = await session.execute(
            select(AgentMemoryModel)
            .where(AgentMemoryModel.agent_id == agent_id)
            .order_by(desc(AgentMemoryModel.created_at))
            .limit(limit)
        )
        return list(res.scalars().all())
