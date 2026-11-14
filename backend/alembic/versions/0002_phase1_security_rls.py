"""Phase 1 Security Lockdown — Complete PostgreSQL Row-Level Security (RLS)

Revision ID: 0002_phase1_security_rls
Revises: 0001_forge_3_0
Create Date: 2026-11-14 23:05:00
"""
from typing import Dict, Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0002_phase1_security_rls"
down_revision: Union[str, None] = "0001_forge_3_0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

BYPASS_CLAUSE = (
    "COALESCE(current_setting('app.bypass_rls', true), 'false') = 'true' "
    "OR COALESCE(current_setting('app.current_platform_role', true), '') IN ('PLATFORM_ADMIN', 'PLATFORM_OPERATOR')"
)

WS_SETTING = "NULLIF(current_setting('app.current_workspace_id', true), '')"
USER_SETTING = "NULLIF(current_setting('app.current_user_id', true), '')"

# Maps each tenant-owned table to its exact ownership predicate
TABLE_RLS_EXPRESSIONS: Dict[str, str] = {
    "users": f"id = {USER_SETTING}",
    "user_profiles": f"user_id = {USER_SETTING}",
    "organizations": f"owner_user_id = {USER_SETTING}",
    "organization_members": f"user_id = {USER_SETTING}",
    "workspaces": f"id = {WS_SETTING} OR owner_user_id = {USER_SETTING}",
    "workspace_members": f"workspace_id = {WS_SETTING} OR user_id = {USER_SETTING}",
    "sessions": f"workspace_id = {WS_SETTING} OR user_id = {USER_SETTING}",
    "github_installations": f"workspace_id = {WS_SETTING}",
    "connected_repositories": f"workspace_id = {WS_SETTING}",
    "integration_credentials": f"workspace_id = {WS_SETTING}",
    "workforces": f"workspace_id = {WS_SETTING}",
    "agents": (
        f"workspace_id = {WS_SETTING} "
        f"OR EXISTS (SELECT 1 FROM workforces w WHERE w.id = agents.workforce_id AND w.workspace_id = {WS_SETTING})"
    ),
    "agent_memory": (
        f"EXISTS (SELECT 1 FROM workforces w WHERE w.id = agent_memory.workforce_id AND w.workspace_id = {WS_SETTING})"
    ),
    "tasks": (
        f"workspace_id = {WS_SETTING} "
        f"OR EXISTS (SELECT 1 FROM workforces w WHERE w.id = tasks.workforce_id AND w.workspace_id = {WS_SETTING})"
    ),
    "task_dependencies": (
        f"EXISTS (SELECT 1 FROM tasks t JOIN workforces w ON w.id = t.workforce_id "
        f"WHERE t.id = task_dependencies.task_id AND w.workspace_id = {WS_SETTING})"
    ),
    "executions": f"workspace_id = {WS_SETTING}",
    "execution_steps": (
        f"EXISTS (SELECT 1 FROM executions e WHERE e.id = execution_steps.execution_id AND e.workspace_id = {WS_SETTING})"
    ),
    "tool_calls": f"workspace_id = {WS_SETTING}",
    "tool_results": (
        f"EXISTS (SELECT 1 FROM executions e WHERE e.id = tool_results.execution_id AND e.workspace_id = {WS_SETTING})"
    ),
    "execution_logs": (
        f"EXISTS (SELECT 1 FROM executions e WHERE e.id = execution_logs.execution_id AND e.workspace_id = {WS_SETTING})"
    ),
    "execution_approvals": f"workspace_id = {WS_SETTING}",
    "execution_leases": f"workspace_id = {WS_SETTING}",
    "execution_queue": f"workspace_id = {WS_SETTING}",
    "meetings": (
        f"workspace_id = {WS_SETTING} "
        f"OR EXISTS (SELECT 1 FROM workforces w WHERE w.id = meetings.workforce_id AND w.workspace_id = {WS_SETTING})"
    ),
    "meeting_participants": (
        f"EXISTS (SELECT 1 FROM meetings m JOIN workforces w ON w.id = m.workforce_id "
        f"WHERE m.id = meeting_participants.meeting_id AND w.workspace_id = {WS_SETTING})"
    ),
    "meeting_messages": (
        f"EXISTS (SELECT 1 FROM meetings m JOIN workforces w ON w.id = m.workforce_id "
        f"WHERE m.id = meeting_messages.meeting_id AND w.workspace_id = {WS_SETTING})"
    ),
    "meeting_presentations": (
        f"EXISTS (SELECT 1 FROM meetings m JOIN workforces w ON w.id = m.workforce_id "
        f"WHERE m.id = meeting_presentations.meeting_id AND w.workspace_id = {WS_SETTING})"
    ),
    "meeting_decisions": (
        f"EXISTS (SELECT 1 FROM workforces w WHERE w.id = meeting_decisions.workforce_id AND w.workspace_id = {WS_SETTING})"
    ),
    "artifacts": f"workspace_id = {WS_SETTING}",
    "artifact_versions": (
        f"EXISTS (SELECT 1 FROM artifacts a WHERE a.id = artifact_versions.artifact_id AND a.workspace_id = {WS_SETTING})"
    ),
    "agent_events": (
        f"EXISTS (SELECT 1 FROM workforces w WHERE w.id = agent_events.workforce_id AND w.workspace_id = {WS_SETTING})"
    ),
    "llm_requests": (
        f"workspace_id = {WS_SETTING} "
        f"OR EXISTS (SELECT 1 FROM workforces w WHERE w.id = llm_requests.workforce_id AND w.workspace_id = {WS_SETTING})"
    ),
    "token_usage": (
        f"workspace_id = {WS_SETTING} "
        f"OR EXISTS (SELECT 1 FROM workforces w WHERE w.id = token_usage.workforce_id AND w.workspace_id = {WS_SETTING})"
    ),
    "usage_records": f"workspace_id = {WS_SETTING}",
    "resource_budgets": f"workspace_id = {WS_SETTING}",
    "audit_logs": f"workspace_id = {WS_SETTING}",
}


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    # 0. Provision dedicated non-BYPASSRLS runtime role so PostgreSQL RLS is strictly enforced
    # even when connecting with Neon's default neondb_owner (which has rolbypassrls=true).
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'forge_app_runtime') THEN
                    CREATE ROLE forge_app_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
                ELSE
                    ALTER ROLE forge_app_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
                END IF;
            END
            $$;
            """
        )
    )
    op.execute(sa.text("GRANT forge_app_runtime TO CURRENT_USER;"))
    op.execute(sa.text("GRANT USAGE ON SCHEMA public TO forge_app_runtime;"))
    op.execute(sa.text("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO forge_app_runtime;"))
    op.execute(sa.text("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO forge_app_runtime;"))
    op.execute(
        sa.text(
            "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO forge_app_runtime;"
        )
    )
    op.execute(
        sa.text(
            "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO forge_app_runtime;"
        )
    )

    # 1. Backfill any NULL workspace_id values on existing tenant records
    op.execute(
        sa.text(
            "UPDATE workforces SET workspace_id = 'ws_forge_default', user_id = COALESCE(user_id, 'usr_director'), "
            "tenant_id = COALESCE(tenant_id, 'ten_usr_director') WHERE workspace_id IS NULL;"
        )
    )
    op.execute(
        sa.text(
            "UPDATE agents a SET workspace_id = w.workspace_id "
            "FROM workforces w WHERE a.workforce_id = w.id AND a.workspace_id IS NULL;"
        )
    )
    op.execute(
        sa.text(
            "UPDATE tasks t SET workspace_id = w.workspace_id "
            "FROM workforces w WHERE t.workforce_id = w.id AND t.workspace_id IS NULL;"
        )
    )
    op.execute(
        sa.text(
            "UPDATE meetings m SET workspace_id = w.workspace_id "
            "FROM workforces w WHERE m.workforce_id = w.id AND m.workspace_id IS NULL;"
        )
    )
    op.execute(
        sa.text(
            "UPDATE llm_requests l SET workspace_id = w.workspace_id, user_id = COALESCE(l.user_id, w.user_id) "
            "FROM workforces w WHERE l.workforce_id = w.id AND l.workspace_id IS NULL;"
        )
    )
    op.execute(
        sa.text(
            "UPDATE token_usage u SET workspace_id = w.workspace_id, user_id = COALESCE(u.user_id, w.user_id) "
            "FROM workforces w WHERE u.workforce_id = w.id AND u.workspace_id IS NULL;"
        )
    )

    # 2. Enable and FORCE Row-Level Security and create SELECT, INSERT, UPDATE, DELETE policies
    for table, tenant_expr in TABLE_RLS_EXPRESSIONS.items():
        full_predicate = f"({BYPASS_CLAUSE}) OR ({tenant_expr})"
        op.execute(sa.text(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table};"))
        op.execute(sa.text(f"DROP POLICY IF EXISTS {table}_rls_select ON {table};"))
        op.execute(sa.text(f"DROP POLICY IF EXISTS {table}_rls_insert ON {table};"))
        op.execute(sa.text(f"DROP POLICY IF EXISTS {table}_rls_update ON {table};"))
        op.execute(sa.text(f"DROP POLICY IF EXISTS {table}_rls_delete ON {table};"))

        op.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;"))
        op.execute(sa.text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;"))

        op.execute(
            sa.text(
                f"CREATE POLICY {table}_rls_select ON {table} FOR SELECT USING ({full_predicate});"
            )
        )
        op.execute(
            sa.text(
                f"CREATE POLICY {table}_rls_insert ON {table} FOR INSERT WITH CHECK ({full_predicate});"
            )
        )
        op.execute(
            sa.text(
                f"CREATE POLICY {table}_rls_update ON {table} FOR UPDATE USING ({full_predicate}) WITH CHECK ({full_predicate});"
            )
        )
        op.execute(
            sa.text(
                f"CREATE POLICY {table}_rls_delete ON {table} FOR DELETE USING ({full_predicate});"
            )
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    for table in TABLE_RLS_EXPRESSIONS:
        op.execute(sa.text(f"DROP POLICY IF EXISTS {table}_rls_select ON {table};"))
        op.execute(sa.text(f"DROP POLICY IF EXISTS {table}_rls_insert ON {table};"))
        op.execute(sa.text(f"DROP POLICY IF EXISTS {table}_rls_update ON {table};"))
        op.execute(sa.text(f"DROP POLICY IF EXISTS {table}_rls_delete ON {table};"))
        op.execute(sa.text(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;"))
        op.execute(sa.text(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;"))
