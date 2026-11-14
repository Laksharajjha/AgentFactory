from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import privileged_rls_context
from app.events.event_bus import event_bus
from app.models import ExecutionModel, ExecutionQueueModel, WorkforceModel
from app.scheduler.capacity_monitor import CapacityMonitor
from app.scheduler.execution_lease import ExecutionLeaseManager
from app.scheduler.fairness_policy import FairnessPolicy
from app.scheduler.queue_repository import QueueRepository


class ExecutionScheduler:
    """Drains the durable execution queue fairly when capacity is released."""

    @staticmethod
    async def release_and_advance_queue(
        session: AsyncSession,
        finished_execution_id: str,
        final_status: str = "COMPLETED",
        error_message: Optional[str] = None,
    ) -> Optional[str]:
        async with privileged_rls_context(session):
            now = datetime.now(timezone.utc)
            await ExecutionLeaseManager.release_lease(session, finished_execution_id, final_status="RELEASED")

            ex_row = (
                await session.execute(
                    select(ExecutionModel).where(ExecutionModel.id == finished_execution_id)
                )
            ).scalar_one_or_none()
            q_row = (
                await session.execute(
                    select(ExecutionQueueModel).where(ExecutionQueueModel.execution_id == finished_execution_id)
                )
            ).scalar_one_or_none()

            if ex_row:
                ex_row.status = final_status
                ex_row.completed_at = now
                if ex_row.started_at:
                    start_dt = ex_row.started_at
                    if start_dt.tzinfo is None:
                        start_dt = start_dt.replace(tzinfo=timezone.utc)
                    ex_row.duration_ms = round((now - start_dt).total_seconds() * 1000.0, 2)
                if error_message:
                    ex_row.error_message = error_message

            if q_row:
                q_row.status = final_status
                q_row.completed_at = now

            await session.commit()

            if ex_row:
                evt_type = (
                    "EXECUTION_COMPLETED"
                    if final_status == "COMPLETED"
                    else "EXECUTION_CANCELLED"
                    if final_status == "CANCELLED"
                    else "EXECUTION_FAILED"
                )
                await event_bus.emit(
                    session=session,
                    workforce_id=ex_row.workforce_id,
                    event_type=evt_type,  # type: ignore[arg-type]
                    entity_id=ex_row.id,
                    payload={
                        "execution_id": ex_row.id,
                        "workforce_id": ex_row.workforce_id,
                        "status": final_status,
                        "error_message": error_message,
                    },
                )

            # Recover any stale leases first
            await ExecutionLeaseManager.recover_stale_leases(session)

            # Pick next eligible queued execution via Round-Robin FairnessPolicy
            next_q = await FairnessPolicy.select_next_eligible_queue_item(session)
            if not next_q:
                return None

            next_q.status = "ADMITTED"
            next_q.admitted_at = now
            next_ex = (
                await session.execute(
                    select(ExecutionModel).where(ExecutionModel.id == next_q.execution_id)
                )
            ).scalar_one_or_none()
            if next_ex:
                next_ex.status = "ADMITTED"
                next_ex.started_at = now

            wf = (
                await session.execute(
                    select(WorkforceModel).where(WorkforceModel.id == next_q.workforce_id)
                )
            ).scalar_one_or_none()
            if wf:
                wf.status = "RUNNING"

            await session.commit()

            await ExecutionLeaseManager.acquire_lease(
                session=session,
                execution_id=next_q.execution_id,
                user_id=next_q.user_id,
                workspace_id=next_q.workspace_id,
            )

            await event_bus.emit(
                session=session,
                workforce_id=next_q.workforce_id,
                event_type="EXECUTION_ADMITTED",
                entity_id=next_q.execution_id,
                payload={
                    "execution_id": next_q.execution_id,
                    "workforce_id": next_q.workforce_id,
                    "user_id": next_q.user_id,
                    "status": "ADMITTED",
                },
            )

            # Broadcast updated queue positions for remaining queued items
            remaining_res = await session.execute(
                select(ExecutionQueueModel)
                .where(ExecutionQueueModel.status == "QUEUED")
                .order_by(ExecutionQueueModel.queued_at.asc())
            )
            for pos_idx, rem in enumerate(remaining_res.scalars().all(), start=1):
                await event_bus.emit(
                    session=session,
                    workforce_id=rem.workforce_id,
                    event_type="QUEUE_POSITION_UPDATED",
                    entity_id=rem.execution_id,
                    payload={
                        "execution_id": rem.execution_id,
                        "queue_position": pos_idx,
                    },
                )

            cap = await CapacityMonitor.get_system_capacity(session)
            await event_bus.emit(
                session=session,
                workforce_id=next_q.workforce_id,
                event_type="CAPACITY_CHANGED",
                entity_id=next_q.execution_id,
                payload=cap,
            )
            return next_q.execution_id
