import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import ExecutionLeaseModel, ExecutionModel, ExecutionQueueModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ExecutionLeaseManager:
    """Manages durable execution leases, worker heartbeats, and crash/stale lease recovery."""

    @staticmethod
    async def acquire_lease(
        session: AsyncSession,
        execution_id: str,
        user_id: str,
        workspace_id: str,
        worker_id: str = "worker-primary-01",
    ) -> ExecutionLeaseModel:
        now = utc_now()
        expires = now + timedelta(seconds=settings.LEASE_TTL_SECONDS)
        existing = (
            await session.execute(
                select(ExecutionLeaseModel).where(ExecutionLeaseModel.execution_id == execution_id)
            )
        ).scalar_one_or_none()

        if existing:
            existing.worker_id = worker_id
            existing.status = "ACTIVE"
            existing.heartbeat_at = now
            existing.expires_at = expires
            existing.released_at = None
            await session.commit()
            return existing

        lease = ExecutionLeaseModel(
            id=f"lse_{uuid.uuid4().hex[:12]}",
            execution_id=execution_id,
            user_id=user_id,
            workspace_id=workspace_id,
            worker_id=worker_id,
            status="ACTIVE",
            heartbeat_at=now,
            expires_at=expires,
            acquired_at=now,
        )
        session.add(lease)
        await session.commit()
        return lease

    @staticmethod
    async def heartbeat(session: AsyncSession, execution_id: str) -> bool:
        now = utc_now()
        lease = (
            await session.execute(
                select(ExecutionLeaseModel).where(
                    ExecutionLeaseModel.execution_id == execution_id,
                    ExecutionLeaseModel.status == "ACTIVE",
                )
            )
        ).scalar_one_or_none()
        if not lease:
            return False
        lease.heartbeat_at = now
        lease.expires_at = now + timedelta(seconds=settings.LEASE_TTL_SECONDS)
        await session.commit()
        return True

    @staticmethod
    async def release_lease(session: AsyncSession, execution_id: str, final_status: str = "RELEASED") -> None:
        now = utc_now()
        lease = (
            await session.execute(
                select(ExecutionLeaseModel).where(ExecutionLeaseModel.execution_id == execution_id)
            )
        ).scalar_one_or_none()
        if lease and lease.status == "ACTIVE":
            lease.status = final_status
            lease.released_at = now
            await session.commit()

    @staticmethod
    async def recover_stale_leases(session: AsyncSession) -> List[str]:
        """Finds expired ACTIVE leases from crashed workers, releases them safely, and re-queues or marks recovery."""
        now = utc_now()
        res = await session.execute(
            select(ExecutionLeaseModel).where(
                ExecutionLeaseModel.status == "ACTIVE",
                ExecutionLeaseModel.expires_at < now,
            )
        )
        stale_leases = list(res.scalars().all())
        recovered_execution_ids: List[str] = []

        for lease in stale_leases:
            lease.status = "RECOVERED"
            lease.released_at = now
            recovered_execution_ids.append(lease.execution_id)

            q_row = (
                await session.execute(
                    select(ExecutionQueueModel).where(ExecutionQueueModel.execution_id == lease.execution_id)
                )
            ).scalar_one_or_none()
            ex_row = (
                await session.execute(
                    select(ExecutionModel).where(ExecutionModel.id == lease.execution_id)
                )
            ).scalar_one_or_none()

            if q_row and q_row.retry_count < q_row.max_retries:
                q_row.retry_count += 1
                q_row.status = "QUEUED"
                if ex_row:
                    ex_row.status = "QUEUED"
            else:
                if q_row:
                    q_row.status = "FAILED"
                if ex_row:
                    ex_row.status = "FAILED"
                    ex_row.error_message = "Worker lease expired and max retries exhausted."

        if stale_leases:
            await session.commit()
        return recovered_execution_ids
