from typing import List, Optional, Set
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import ExecutionLeaseModel, ExecutionQueueModel


class FairnessPolicy:
    """Round-robin fair scheduler ensuring no single user monopolizes execution capacity."""

    _last_admitted_user_id: Optional[str] = None

    @classmethod
    async def select_next_eligible_queue_item(
        cls,
        session: AsyncSession,
    ) -> Optional[ExecutionQueueModel]:
        # 1. Check active leases per user
        active_res = await session.execute(
            select(ExecutionLeaseModel).where(ExecutionLeaseModel.status == "ACTIVE")
        )
        active_leases = list(active_res.scalars().all())
        if len(active_leases) >= settings.MAX_CONCURRENT_WORKFORCES:
            return None

        user_active_counts: dict[str, int] = {}
        for lse in active_leases:
            user_active_counts[lse.user_id] = user_active_counts.get(lse.user_id, 0) + 1

        # 2. Load all QUEUED items ordered by priority DESC, queued_at ASC
        q_res = await session.execute(
            select(ExecutionQueueModel)
            .where(ExecutionQueueModel.status == "QUEUED")
            .order_by(ExecutionQueueModel.queued_at.asc())
        )
        queued_items: List[ExecutionQueueModel] = list(q_res.scalars().all())
        if not queued_items:
            return None

        # Filter to users under their per-user concurrent execution cap
        eligible = [
            item
            for item in queued_items
            if user_active_counts.get(item.user_id, 0) < settings.MAX_CONCURRENT_EXECUTIONS_PER_USER
        ]
        if not eligible:
            return None

        # Round-robin fairness: prefer a user different from `_last_admitted_user_id` if multiple users are waiting
        distinct_users: Set[str] = {item.user_id for item in eligible}
        if len(distinct_users) > 1 and cls._last_admitted_user_id in distinct_users:
            for item in eligible:
                if item.user_id != cls._last_admitted_user_id:
                    cls._last_admitted_user_id = item.user_id
                    return item

        chosen = eligible[0]
        cls._last_admitted_user_id = chosen.user_id
        return chosen
