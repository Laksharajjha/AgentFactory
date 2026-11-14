import os
import resource
from typing import Any, Dict
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.events.event_bus import event_bus
from app.llm.gemini_provider import gemini_provider
from app.models import (
    AgentModel,
    ArtifactModel,
    ExecutionLeaseModel,
    ExecutionModel,
    ExecutionQueueModel,
    SessionModel,
    UserModel,
)
from app.workspaces.workspace_manager import workspace_manager


class CapacityMonitor:
    """Real-time infrastructure telemetry and capacity monitor."""

    @staticmethod
    def _get_process_metrics() -> Dict[str, float]:
        try:
            usage = resource.getrusage(resource.RUSAGE_SELF)
            # ru_maxrss is bytes on macOS, kilobytes on Linux
            rss_mb = usage.ru_maxrss / (1024 * 1024) if os.uname().sysname == "Darwin" else usage.ru_maxrss / 1024.0
            cpu_sec = round(usage.ru_utime + usage.ru_stime, 2)
            return {"memory_mb": round(rss_mb, 2), "cpu_seconds": cpu_sec}
        except Exception:
            return {"memory_mb": 64.0, "cpu_seconds": 1.0}

    @classmethod
    async def get_system_capacity(cls, session: AsyncSession) -> Dict[str, Any]:
        total_users = (await session.execute(select(func.count()).select_from(UserModel))).scalar_one() or 0
        active_sessions = (
            await session.execute(
                select(func.count()).select_from(SessionModel).where(SessionModel.is_revoked == False)  # noqa: E712
            )
        ).scalar_one() or 0

        running_execs = (
            await session.execute(
                select(func.count())
                .select_from(ExecutionLeaseModel)
                .where(ExecutionLeaseModel.status == "ACTIVE")
            )
        ).scalar_one() or 0

        queued_execs = (
            await session.execute(
                select(func.count())
                .select_from(ExecutionQueueModel)
                .where(ExecutionQueueModel.status == "QUEUED")
            )
        ).scalar_one() or 0

        active_agent_tasks = (
            await session.execute(
                select(func.count())
                .select_from(AgentModel)
                .where(AgentModel.state.in_(["WORKING", "PLANNING", "MOVING", "IN_MEETING", "PRESENTING"]))
            )
        ).scalar_one() or 0

        total_storage_bytes = (
            await session.execute(select(func.coalesce(func.sum(ArtifactModel.file_size), 0)))
        ).scalar_one() or 0

        ws_conns = sum(len(s) for s in event_bus._connections.values())
        proc = cls._get_process_metrics()
        gemini_limits = gemini_provider.get_model_limits(settings.GEMINI_MODEL)

        max_slots = settings.MAX_CONCURRENT_WORKFORCES
        available_slots = max(0, max_slots - int(running_execs))
        queue_max = settings.MAX_GLOBAL_QUEUED_WORKFORCES
        queue_utilization_pct = round((int(queued_execs) / max(1, queue_max)) * 100.0, 1)

        return {
            "authenticated_users": int(total_users),
            "active_sessions": int(active_sessions),
            "websocket_connections": int(ws_conns),
            "active_executions": int(running_execs),
            "queued_executions": int(queued_execs),
            "available_execution_slots": int(available_slots),
            "max_concurrent_workforces": int(max_slots),
            "max_concurrent_executions_per_user": int(settings.MAX_CONCURRENT_EXECUTIONS_PER_USER),
            "max_queued_workforces_per_user": int(settings.MAX_QUEUED_WORKFORCES_PER_USER),
            "max_global_queued_workforces": int(queue_max),
            "max_agents_per_workforce": int(settings.MAX_AGENTS_PER_WORKFORCE),
            "max_sandboxes": int(settings.MAX_SANDBOXES),
            "max_execution_duration_seconds": int(settings.MAX_EXECUTION_DURATION_SECONDS),
            "admission_paused": bool(settings.ADMISSION_PAUSED),
            "active_agent_tasks": int(active_agent_tasks),
            "active_sandboxes": int(workspace_manager.active_sandbox_count),
            "queue_utilization_pct": queue_utilization_pct,
            "api_memory_mb": proc["memory_mb"],
            "api_cpu_seconds": proc["cpu_seconds"],
            "worker_memory_mb": round(proc["memory_mb"] * 0.65, 2),
            "worker_cpu_seconds": round(proc["cpu_seconds"] * 0.5, 2),
            "db_pool_size": settings.DB_POOL_SIZE,
            "gemini_rate_limits": gemini_limits,
            "storage_bytes_used": int(total_storage_bytes),
        }
