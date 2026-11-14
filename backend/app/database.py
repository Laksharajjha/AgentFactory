from contextlib import asynccontextmanager
from contextvars import ContextVar
import logging
from typing import Any, AsyncIterator, Dict, Optional
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

logger = logging.getLogger("project_forge.database")

_DEFAULT_RLS_STATE: Dict[str, str] = {
    "user_id": "",
    "workspace_id": "",
    "platform_role": "ANONYMOUS",
    "bypass_rls": "false",
}

_rls_context_var: ContextVar[Dict[str, str]] = ContextVar(
    "forge_rls_context",
    default=dict(_DEFAULT_RLS_STATE),
)


def get_current_rls_state() -> Dict[str, str]:
    return dict(_rls_context_var.get())


def set_current_rls_state(
    user_id: Optional[str] = None,
    workspace_id: Optional[str] = None,
    platform_role: str = "USER",
    bypass_rls: bool = False,
) -> Dict[str, str]:
    state = {
        "user_id": (user_id or "").strip(),
        "workspace_id": (workspace_id or "").strip(),
        "platform_role": (platform_role or "USER").strip(),
        "bypass_rls": "true" if bypass_rls else "false",
    }
    _rls_context_var.set(state)
    return state


def reset_current_rls_state() -> None:
    _rls_context_var.set(dict(_DEFAULT_RLS_STATE))


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

    # Neon PostgreSQL / asyncpg engine with production connection pooling & automatic RLS context binding
    eng = create_async_engine(
        db_url,
        echo=False,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_recycle=settings.DB_POOL_RECYCLE_SECONDS,
        pool_pre_ping=True,
    )

    @event.listens_for(eng.sync_engine, "begin")
    def _apply_rls_on_transaction_begin(conn) -> None:
        if not settings.ENABLE_RLS:
            return
        state = _rls_context_var.get()
        if state.get("bypass_rls") != "true":
            conn.execute(text("SET LOCAL ROLE forge_app_runtime"))
        conn.execute(
            text(
                "SELECT "
                "set_config('app.current_user_id', :uid, true), "
                "set_config('app.current_workspace_id', :wid, true), "
                "set_config('app.current_platform_role', :role, true), "
                "set_config('app.bypass_rls', :bypass, true)"
            ),
            {
                "uid": state.get("user_id", ""),
                "wid": state.get("workspace_id", ""),
                "role": state.get("platform_role", "ANONYMOUS"),
                "bypass": state.get("bypass_rls", "false"),
            },
        )

    return eng


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
    bypass_rls: bool = False,
) -> None:
    """Applies PostgreSQL Row-Level Security variables to both ContextVar and the current transaction."""
    state = set_current_rls_state(
        user_id=user_id,
        workspace_id=workspace_id,
        platform_role=platform_role,
        bypass_rls=bypass_rls,
    )
    if not settings.is_postgres or not settings.ENABLE_RLS:
        return
    if not bypass_rls:
        await session.execute(text("SET LOCAL ROLE forge_app_runtime"))
    await session.execute(
        text(
            "SELECT "
            "set_config('app.current_user_id', :uid, true), "
            "set_config('app.current_workspace_id', :wid, true), "
            "set_config('app.current_platform_role', :role, true), "
            "set_config('app.bypass_rls', :bypass, true)"
        ),
        {
            "uid": state["user_id"],
            "wid": state["workspace_id"],
            "role": state["platform_role"],
            "bypass": state["bypass_rls"],
        },
    )


async def clear_rls_context(session: Optional[AsyncSession] = None) -> None:
    """Clears tenant RLS context so pooled connections never retain prior tenant state."""
    reset_current_rls_state()
    if session is not None and settings.is_postgres and settings.ENABLE_RLS and session.in_transaction():
        try:
            await session.execute(
                text(
                    "SELECT "
                    "set_config('app.current_user_id', '', true), "
                    "set_config('app.current_workspace_id', '', true), "
                    "set_config('app.current_platform_role', 'ANONYMOUS', true), "
                    "set_config('app.bypass_rls', 'false', true)"
                )
            )
        except Exception:
            pass


@asynccontextmanager
async def privileged_rls_context(session: Optional[AsyncSession] = None) -> AsyncIterator[None]:
    """Explicit, auditable privileged context for migrations, auth bootstrap, and global queue scheduling."""
    prev_state = get_current_rls_state()
    set_current_rls_state(
        user_id=prev_state.get("user_id") or "system",
        workspace_id=prev_state.get("workspace_id") or "",
        platform_role="SYSTEM_PRIVILEGED",
        bypass_rls=True,
    )
    if session is not None and settings.is_postgres and settings.ENABLE_RLS:
        await session.execute(
            text(
                "SELECT "
                "set_config('app.current_platform_role', 'SYSTEM_PRIVILEGED', true), "
                "set_config('app.bypass_rls', 'true', true)"
            )
        )
    try:
        yield
    finally:
        _rls_context_var.set(prev_state)
        if session is not None and settings.is_postgres and settings.ENABLE_RLS and session.in_transaction():
            try:
                await session.execute(
                    text(
                        "SELECT "
                        "set_config('app.current_user_id', :uid, true), "
                        "set_config('app.current_workspace_id', :wid, true), "
                        "set_config('app.current_platform_role', :role, true), "
                        "set_config('app.bypass_rls', :bypass, true)"
                    ),
                    {
                        "uid": prev_state.get("user_id", ""),
                        "wid": prev_state.get("workspace_id", ""),
                        "role": prev_state.get("platform_role", "ANONYMOUS"),
                        "bypass": prev_state.get("bypass_rls", "false"),
                    },
                )
            except Exception:
                pass


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
        async with privileged_rls_context():
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
    async with privileged_rls_context():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        await _ensure_backward_compatible_columns()


async def get_db():
    reset_current_rls_state()
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await clear_rls_context(session)
