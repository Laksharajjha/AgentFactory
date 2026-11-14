from typing import Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import privileged_rls_context
from app.models import ExecutionLeaseModel, ExecutionQueueModel


class QuotaManager:
    """Enforces per-user and global execution and queue quotas."""

    @staticmethod
    async def check_user_and_global_quotas(
        session: AsyncSession,
        user_id: str,
    ) -> Tuple[str, str]:
        """Returns ('ADMIT' | 'QUEUE' | 'REJECT', reason)."""
        if settings.ADMISSION_PAUSED:
            return ("QUEUE", "Administrator has paused new execution admission; request queued.")

        async with privileged_rls_context(session):
            global_active = (
                await session.execute(
                    select(func.count())
                    .select_from(ExecutionLeaseModel)
                    .where(ExecutionLeaseModel.status == "ACTIVE")
                )
            ).scalar_one() or 0

            user_active = (
                await session.execute(
                    select(func.count())
                    .select_from(ExecutionLeaseModel)
                    .where(
                        ExecutionLeaseModel.user_id == user_id,
                        ExecutionLeaseModel.status == "ACTIVE",
                    )
                )
            ).scalar_one() or 0

            global_queued = (
                await session.execute(
                    select(func.count())
                    .select_from(ExecutionQueueModel)
                    .where(ExecutionQueueModel.status == "QUEUED")
                )
            ).scalar_one() or 0

            user_queued = (
                await session.execute(
                    select(func.count())
                    .select_from(ExecutionQueueModel)
                    .where(
                        ExecutionQueueModel.user_id == user_id,
                        ExecutionQueueModel.status == "QUEUED",
                    )
                )
            ).scalar_one() or 0

        # Check if user or global queue is completely full
        if int(user_queued) >= settings.MAX_QUEUED_WORKFORCES_PER_USER:
            return (
                "REJECT",
                f"Per-user queue limit reached ({user_queued}/{settings.MAX_QUEUED_WORKFORCES_PER_USER}). Wait for queued jobs to finish.",
            )
        if int(global_queued) >= settings.MAX_GLOBAL_QUEUED_WORKFORCES:
            return (
                "REJECT",
                f"Global execution queue capacity reached ({global_queued}/{settings.MAX_GLOBAL_QUEUED_WORKFORCES}). Retry shortly.",
            )

        # Check if an execution slot is immediately available for this user
        if (
            int(global_active) < settings.MAX_CONCURRENT_WORKFORCES
            and int(user_active) < settings.MAX_CONCURRENT_EXECUTIONS_PER_USER
        ):
            return ("ADMIT", "Execution slot available.")

        if int(user_active) >= settings.MAX_CONCURRENT_EXECUTIONS_PER_USER:
            return (
                "QUEUE",
                f"User already has {user_active}/{settings.MAX_CONCURRENT_EXECUTIONS_PER_USER} active execution(s). Placed in durable queue.",
            )

        return (
            "QUEUE",
            f"All {settings.MAX_CONCURRENT_WORKFORCES} global execution slots are occupied. Placed in durable queue.",
        )
