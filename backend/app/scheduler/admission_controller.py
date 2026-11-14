import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.event_bus import event_bus
from app.models import ExecutionModel, ExecutionQueueModel, WorkforceModel
from app.scheduler.execution_lease import ExecutionLeaseManager
from app.scheduler.fairness_policy import FairnessPolicy
from app.scheduler.queue_repository import QueueRepository
from app.scheduler.quota_manager import QuotaManager

_admission_lock = asyncio.Lock()


class AdmissionController:
    """Evaluates admission vs queuing vs backpressure rejection under an atomic lock."""

    @staticmethod
    async def submit_workforce_execution(
        session: AsyncSession,
        tenant_id: str,
        user_id: str,
        workspace_id: str,
        workforce: WorkforceModel,
        execution_type: str = "WORKFORCE_RUN",
        idempotency_key: Optional[str] = None,
        inputs: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        async with _admission_lock:
            # Check idempotency key first
            if idempotency_key:
                existing_q = (
                    await session.execute(
                        select(ExecutionQueueModel).where(
                            ExecutionQueueModel.idempotency_key == idempotency_key
                        )
                    )
                ).scalar_one_or_none()
                if existing_q:
                    ex = (
                        await session.execute(
                            select(ExecutionModel).where(ExecutionModel.id == existing_q.execution_id)
                        )
                    ).scalar_one_or_none()
                    pos = await QueueRepository.get_queue_position(session, existing_q.execution_id)
                    return {
                        "execution_id": existing_q.execution_id,
                        "status": ex.status if ex else existing_q.status,
                        "queue_position": pos,
                        "idempotent_replay": True,
                    }

            decision, reason = await QuotaManager.check_user_and_global_quotas(session, user_id)
            if decision == "REJECT":
                raise HTTPException(
                    status_code=429,
                    detail={
                        "error": "EXECUTION_QUEUE_CAPACITY_EXCEEDED",
                        "message": reason,
                        "retry_after_seconds": 15,
                    },
                )

            exec_id = f"exc_{uuid.uuid4().hex[:12]}"
            now = datetime.now(timezone.utc)
            initial_status = "ADMITTED" if decision == "ADMIT" else "QUEUED"

            exec_row = ExecutionModel(
                id=exec_id,
                tenant_id=tenant_id,
                user_id=user_id,
                workspace_id=workspace_id,
                workforce_id=workforce.id,
                repository_id=workforce.repository_id,
                execution_type=execution_type,
                status=initial_status,
                execution_mode="REAL_TOOL_EXECUTION",
                working_branch=workforce.working_branch or f"forge/exec-{exec_id[-6:]}",
                inputs_json=inputs or {"objective": workforce.objective},
                started_at=now if initial_status == "ADMITTED" else None,
            )
            session.add(exec_row)
            await session.flush()

            q_row = ExecutionQueueModel(
                id=f"eq_{uuid.uuid4().hex[:12]}",
                execution_id=exec_id,
                workforce_id=workforce.id,
                user_id=user_id,
                workspace_id=workspace_id,
                priority=10,
                status=initial_status,
                idempotency_key=idempotency_key,
                queued_at=now,
                admitted_at=now if initial_status == "ADMITTED" else None,
            )
            session.add(q_row)

            workforce.status = "RUNNING" if initial_status == "ADMITTED" else "QUEUED"
            await session.commit()

            if initial_status == "ADMITTED":
                FairnessPolicy._last_admitted_user_id = user_id
                await ExecutionLeaseManager.acquire_lease(
                    session=session,
                    execution_id=exec_id,
                    user_id=user_id,
                    workspace_id=workspace_id,
                )
                await event_bus.emit(
                    session=session,
                    workforce_id=workforce.id,
                    event_type="EXECUTION_ADMITTED",
                    entity_id=exec_id,
                    payload={
                        "execution_id": exec_id,
                        "workforce_id": workforce.id,
                        "user_id": user_id,
                        "workspace_id": workspace_id,
                        "status": "ADMITTED",
                        "reason": reason,
                    },
                )
                return {
                    "execution_id": exec_id,
                    "status": "ADMITTED",
                    "queue_position": 0,
                    "reason": reason,
                }

            pos = await QueueRepository.get_queue_position(session, exec_id)
            await event_bus.emit(
                session=session,
                workforce_id=workforce.id,
                event_type="EXECUTION_QUEUED",
                entity_id=exec_id,
                payload={
                    "execution_id": exec_id,
                    "workforce_id": workforce.id,
                    "user_id": user_id,
                    "workspace_id": workspace_id,
                    "status": "QUEUED",
                    "queue_position": pos or 1,
                    "reason": reason,
                },
            )
            return {
                "execution_id": exec_id,
                "status": "QUEUED",
                "queue_position": pos or 1,
                "reason": reason,
            }
