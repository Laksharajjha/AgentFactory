from datetime import datetime, timezone
from typing import Any, Dict, Optional
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import privileged_rls_context
from app.models import ExecutionModel, ExecutionQueueModel, WorkforceModel
from app.scheduler.admission_controller import AdmissionController
from app.scheduler.capacity_monitor import CapacityMonitor
from app.scheduler.execution_lease import ExecutionLeaseManager
from app.scheduler.execution_scheduler import ExecutionScheduler
from app.scheduler.queue_repository import QueueRepository


class ResourceGovernor:
    """Central Resource Governor enforcing admission control, leases, fairness, and admin capacity policies."""

    @staticmethod
    async def submit(
        session: AsyncSession,
        tenant_id: str,
        user_id: str,
        workspace_id: str,
        workforce: WorkforceModel,
        execution_type: str = "WORKFORCE_RUN",
        idempotency_key: Optional[str] = None,
        inputs: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return await AdmissionController.submit_workforce_execution(
            session=session,
            tenant_id=tenant_id,
            user_id=user_id,
            workspace_id=workspace_id,
            workforce=workforce,
            execution_type=execution_type,
            idempotency_key=idempotency_key,
            inputs=inputs,
        )

    @staticmethod
    async def cancel_execution(
        session: AsyncSession,
        execution_id: str,
        user_id: str,
        is_admin: bool = False,
    ) -> Dict[str, Any]:
        async with privileged_rls_context(session):
            ex = (
                await session.execute(select(ExecutionModel).where(ExecutionModel.id == execution_id))
            ).scalar_one_or_none()
        if not ex:
            raise HTTPException(status_code=404, detail="Execution not found.")
        if ex.user_id != user_id and not is_admin:
            raise HTTPException(status_code=403, detail="Cannot cancel another user's execution.")

        next_exec_id = await ExecutionScheduler.release_and_advance_queue(
            session=session,
            finished_execution_id=execution_id,
            final_status="CANCELLED",
            error_message="Cancelled by user.",
        )
        return {
            "cancelled_execution_id": execution_id,
            "status": "CANCELLED",
            "next_admitted_execution_id": next_exec_id,
        }

    @staticmethod
    def update_governor_config(payload: Dict[str, Any]) -> Dict[str, Any]:
        if "max_concurrent_workforces" in payload and payload["max_concurrent_workforces"] is not None:
            settings.MAX_CONCURRENT_WORKFORCES = max(1, int(payload["max_concurrent_workforces"]))
        if "max_concurrent_executions_per_user" in payload and payload["max_concurrent_executions_per_user"] is not None:
            settings.MAX_CONCURRENT_EXECUTIONS_PER_USER = max(1, int(payload["max_concurrent_executions_per_user"]))
        if "max_queued_workforces_per_user" in payload and payload["max_queued_workforces_per_user"] is not None:
            settings.MAX_QUEUED_WORKFORCES_PER_USER = max(1, int(payload["max_queued_workforces_per_user"]))
        if "max_global_queued_workforces" in payload and payload["max_global_queued_workforces"] is not None:
            settings.MAX_GLOBAL_QUEUED_WORKFORCES = max(1, int(payload["max_global_queued_workforces"]))
        if "max_agents_per_workforce" in payload and payload["max_agents_per_workforce"] is not None:
            settings.MAX_AGENTS_PER_WORKFORCE = max(1, int(payload["max_agents_per_workforce"]))
        if "max_execution_duration_seconds" in payload and payload["max_execution_duration_seconds"] is not None:
            settings.MAX_EXECUTION_DURATION_SECONDS = max(30, int(payload["max_execution_duration_seconds"]))
        if "admission_paused" in payload and payload["admission_paused"] is not None:
            settings.ADMISSION_PAUSED = bool(payload["admission_paused"])

        return {
            "max_concurrent_workforces": settings.MAX_CONCURRENT_WORKFORCES,
            "max_concurrent_executions_per_user": settings.MAX_CONCURRENT_EXECUTIONS_PER_USER,
            "max_queued_workforces_per_user": settings.MAX_QUEUED_WORKFORCES_PER_USER,
            "max_global_queued_workforces": settings.MAX_GLOBAL_QUEUED_WORKFORCES,
            "max_agents_per_workforce": settings.MAX_AGENTS_PER_WORKFORCE,
            "max_execution_duration_seconds": settings.MAX_EXECUTION_DURATION_SECONDS,
            "admission_paused": settings.ADMISSION_PAUSED,
        }
