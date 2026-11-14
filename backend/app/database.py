import logging
from typing import Any, Dict, Optional
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

logger = logging.getLogger("project_forge.database")


def _build_engine():
    db_url = settings.effective_database_url
    if db_url.startswith("sqlite"):
        eng = create_async_engine(
            db_url,
            echo=False,
            connect_args={"check_same_thread": False, "timeout": 30},
        )

        @event.listens_for(eng.sync_engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, _connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA synchronous=NORMAL;")
            cursor.execute("PRAGMA busy_timeout=30000;")
            cursor.execute("PRAGMA foreign_keys=ON;")
            cursor.close()

        return eng

    # Neon PostgreSQL / asyncpg engine with production connection pooling
    return create_async_engine(
        db_url,
        echo=False,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_recycle=settings.DB_POOL_RECYCLE_SECONDS,
        pool_pre_ping=True,
    )


engine = _build_engine()

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def apply_rls_context(
    session: AsyncSession,
    user_id: Optional[str] = None,
    workspace_id: Optional[str] = None,
    platform_role: str = "USER",
) -> None:
    """Applies PostgreSQL Row-Level Security session variables on PostgreSQL connections."""
    if not settings.is_postgres or not settings.ENABLE_RLS:
        return
    try:
        await session.execute(
            text("SELECT set_config('app.current_user_id', :uid, true)"),
            {"uid": user_id or ""},
        )
        await session.execute(
            text("SELECT set_config('app.current_workspace_id', :wid, true)"),
            {"wid": workspace_id or ""},
        )
        await session.execute(
            text("SELECT set_config('app.current_platform_role', :role, true)"),
            {"role": platform_role},
        )
    except Exception as exc:
        logger.debug("RLS session context skipped: %s", exc)


async def _ensure_backward_compatible_columns() -> None:
    """Non-destructively adds Project Forge 3.0 multi-tenant columns to existing SQLite/Postgres tables."""
    bool_true = "TRUE" if settings.is_postgres else "1"
    alter_statements = [
        ("users", "email", "VARCHAR(256)"),
        ("users", "password_hash", "VARCHAR(256)"),
        ("users", "platform_role", "VARCHAR(64) DEFAULT 'USER'"),
        ("users", "email_verified", f"BOOLEAN DEFAULT {bool_true}"),
        ("users", "auth_provider", "VARCHAR(64) DEFAULT 'local'"),
        ("users", "default_workspace_id", "VARCHAR(64)"),
        ("users", "is_active", f"BOOLEAN DEFAULT {bool_true}"),
        ("workforces", "workspace_id", "VARCHAR(64)"),
        ("workforces", "tenant_id", "VARCHAR(64)"),
        ("workforces", "repository_id", "VARCHAR(64)"),
        ("workforces", "working_branch", "VARCHAR(128)"),
        ("agents", "workspace_id", "VARCHAR(64)"),
        ("tasks", "workspace_id", "VARCHAR(64)"),
        ("tasks", "execution_id", "VARCHAR(64)"),
        ("tasks", "verification_status", "VARCHAR(64) DEFAULT 'PENDING'"),
        ("meetings", "workspace_id", "VARCHAR(64)"),
        ("llm_requests", "user_id", "VARCHAR(64)"),
        ("llm_requests", "workspace_id", "VARCHAR(64)"),
        ("token_usage", "user_id", "VARCHAR(64)"),
        ("token_usage", "workspace_id", "VARCHAR(64)"),
    ]
    if settings.is_postgres:
        async with engine.begin() as conn:
            for table_name, col_name, col_type in alter_statements:
                await conn.execute(
                    text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col_name} {col_type}")
                )
    else:
        for table_name, col_name, col_type in alter_statements:
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"))
            except Exception:
                # Column already exists in SQLite
                pass


async def init_db() -> None:
    from app import models  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _ensure_backward_compatible_columns()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
