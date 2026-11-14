"""Project Forge 3.0 Complete Multi-Tenant Schema & Row-Level Security Policies

Revision ID: 0001_forge_3_0
Revises:
Create Date: 2026-11-14 15:00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from app.database import Base
from app import models  # noqa: F401

revision: str = "0001_forge_3_0"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RLS_TABLES = [
    "workspaces",
    "workforces",
    "executions",
    "artifacts",
    "connected_repositories",
    "github_installations",
    "integration_credentials",
]


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)

    if bind.dialect.name == "postgresql":
        for table in RLS_TABLES:
            col = "id" if table == "workspaces" else "workspace_id"
            op.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;"))
            op.execute(
                sa.text(
                    f"""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_policies WHERE tablename = '{table}' AND policyname = '{table}_tenant_isolation'
                        ) THEN
                            CREATE POLICY {table}_tenant_isolation ON {table}
                            USING (
                                current_setting('app.current_platform_role', true) = 'PLATFORM_ADMIN'
                                OR {col} = current_setting('app.current_workspace_id', true)
                            );
                        END IF;
                    END
                    $$;
                    """
                )
            )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for table in RLS_TABLES:
            op.execute(sa.text(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table};"))
            op.execute(sa.text(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;"))
