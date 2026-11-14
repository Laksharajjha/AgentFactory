"""Safe Non-Destructive SQLite-to-Neon PostgreSQL Data Migration & Verification Script.

Usage:
    PYTHONPATH=backend python backend/scripts/migrate_sqlite_to_postgres.py \
        --source sqlite+aiosqlite:///./project_forge.db \
        --target postgresql+asyncpg://user:pass@ep-xxx.aws.neon.tech/neondb
"""
import argparse
import asyncio
import logging
from typing import Dict, List, Type
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base
from app.models import (
    AgentEventModel,
    AgentMemoryModel,
    AgentModel,
    ArtifactModel,
    ArtifactVersionModel,
    AuditLogModel,
    ConnectedRepositoryModel,
    ExecutionApprovalModel,
    ExecutionLeaseModel,
    ExecutionLogModel,
    ExecutionModel,
    ExecutionQueueModel,
    ExecutionStepModel,
    GitHubInstallationModel,
    IntegrationCredentialModel,
    LLMRequestModel,
    MeetingDecisionModel,
    MeetingMessageModel,
    MeetingModel,
    MeetingParticipantModel,
    MeetingPresentationModel,
    OrganizationMemberModel,
    OrganizationModel,
    ResourceBudgetModel,
    SessionModel,
    TaskDependencyModel,
    TaskModel,
    TokenUsageModel,
    ToolCallModel,
    ToolResultModel,
    UsageRecordModel,
    UserModel,
    UserProfileModel,
    WorkforceModel,
    WorkspaceMemberModel,
    WorkspaceModel,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("forge.migration")

ORDERED_MODELS: List[Type[Base]] = [
    UserModel,
    UserProfileModel,
    OrganizationModel,
    OrganizationMemberModel,
    WorkspaceModel,
    WorkspaceMemberModel,
    SessionModel,
    GitHubInstallationModel,
    ConnectedRepositoryModel,
    IntegrationCredentialModel,
    WorkforceModel,
    AgentModel,
    AgentMemoryModel,
    TaskModel,
    TaskDependencyModel,
    MeetingModel,
    MeetingParticipantModel,
    MeetingMessageModel,
    MeetingPresentationModel,
    MeetingDecisionModel,
    ExecutionModel,
    ExecutionStepModel,
    ToolCallModel,
    ToolResultModel,
    ExecutionLogModel,
    ExecutionApprovalModel,
    ExecutionLeaseModel,
    ExecutionQueueModel,
    ArtifactModel,
    ArtifactVersionModel,
    AgentEventModel,
    LLMRequestModel,
    TokenUsageModel,
    UsageRecordModel,
    ResourceBudgetModel,
    AuditLogModel,
]


async def migrate_and_verify(source_url: str, target_url: str) -> Dict[str, Dict[str, int]]:
    src_engine = create_async_engine(source_url, echo=False)
    tgt_engine = create_async_engine(target_url, echo=False)

    async with tgt_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    src_session_maker = async_sessionmaker(src_engine, class_=AsyncSession, expire_on_commit=False)
    tgt_session_maker = async_sessionmaker(tgt_engine, class_=AsyncSession, expire_on_commit=False)

    summary: Dict[str, Dict[str, int]] = {}

    async with src_session_maker() as src_session, tgt_session_maker() as tgt_session:
        for model_cls in ORDERED_MODELS:
            table_name = model_cls.__tablename__
            try:
                rows = list((await src_session.execute(select(model_cls))).scalars().all())
            except Exception as exc:
                logger.warning("Skipping %s (not present in source): %s", table_name, exc)
                continue

            migrated_count = 0
            for row in rows:
                data = {col.name: getattr(row, col.name) for col in model_cls.__table__.columns}
                await tgt_session.merge(model_cls(**data))
                migrated_count += 1

            await tgt_session.commit()
            tgt_count = (await tgt_session.execute(select(func.count()).select_from(model_cls))).scalar_one()
            summary[table_name] = {
                "source_rows": len(rows),
                "migrated_rows": migrated_count,
                "target_verified_rows": int(tgt_count),
            }
            logger.info(
                "Table %-26s | source=%d | target_verified=%d",
                table_name,
                len(rows),
                tgt_count,
            )

    await src_engine.dispose()
    await tgt_engine.dispose()
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate SQLite data to Neon PostgreSQL safely.")
    parser.add_argument("--source", default="sqlite+aiosqlite:///./project_forge.db")
    parser.add_argument("--target", required=True)
    args = parser.parse_args()
    asyncio.run(migrate_and_verify(args.source, args.target))
