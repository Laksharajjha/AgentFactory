from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import privileged_rls_context
from app.models import ExecutionLeaseModel, ExecutionModel, ExecutionQueueModel


class QueueRepository:
    """Durable PostgreSQL-backed execution queue queries and position calculator."""

    @staticmethod
    async def get_queue_position(session: AsyncSession, execution_id: str) -> Optional[int]:
        async with privileged_rls_context(session):
            res = await session.execute(
                select(ExecutionQueueModel)
                .where(ExecutionQueueModel.status == "QUEUED")
                .order_by(ExecutionQueueModel.queued_at.asc())
            )
            items = list(res.scalars().all())
        for idx, item in enumerate(items, start=1):
            if item.execution_id == execution_id:
                return idx
        return None

    @staticmethod
    async def list_queue_snapshot(
        session: AsyncSession,
        workspace_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        async with privileged_rls_context(session):
            res = await session.execute(
                select(ExecutionQueueModel).order_by(ExecutionQueueModel.queued_at.desc()).limit(40)
            )
            all_rows = list(res.scalars().all())

        queued_ordered = sorted(
            [r for r in all_rows if r.status == "QUEUED"],
            key=lambda x: x.queued_at,
        )
        pos_map = {r.execution_id: i + 1 for i, r in enumerate(queued_ordered)}

        out: List[Dict[str, Any]] = []
        for r in all_rows:
            if workspace_id and r.workspace_id != workspace_id:
                continue
            out.append(
                {
                    "id": r.id,
                    "execution_id": r.execution_id,
                    "workforce_id": r.workforce_id,
                    "user_id": r.user_id,
                    "workspace_id": r.workspace_id,
                    "status": r.status,
                    "queue_position": pos_map.get(r.execution_id),
                    "retry_count": r.retry_count,
                    "queued_at": r.queued_at.isoformat() if r.queued_at else "",
                    "admitted_at": r.admitted_at.isoformat() if r.admitted_at else None,
                    "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                }
            )
        return out
