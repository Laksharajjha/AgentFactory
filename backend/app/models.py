from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from app.database import Base

# Use native JSONB on Neon PostgreSQL and standard JSON on SQLite
FlexibleJSON = JSON().with_variant(JSONB(), "postgresql")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ============================================================================
# DOMAIN 1 — IDENTITY & MULTI-TENANT RBAC
# ============================================================================


class UserModel(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False)
    email = Column(String(256), nullable=True, unique=True, index=True)
    password_hash = Column(String(256), nullable=True)
    role = Column(String(64), default="Director")
    platform_role = Column(String(64), nullable=False, default="USER", index=True)  # PLATFORM_ADMIN, PLATFORM_OPERATOR, USER
    email_verified = Column(Boolean, nullable=False, default=True)
    auth_provider = Column(String(64), nullable=False, default="local")  # local, google, github
    default_workspace_id = Column(String(64), nullable=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class UserProfileModel(Base):
    __tablename__ = "user_profiles"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    title = Column(String(128), nullable=True, default="Engineering Lead")
    department = Column(String(128), nullable=True, default="Autonomous Systems")
    avatar_url = Column(String(512), nullable=True)
    preferences = Column(FlexibleJSON, nullable=False, default=dict)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class OrganizationModel(Base):
    __tablename__ = "organizations"

    id = Column(String(64), primary_key=True)
    name = Column(String(256), nullable=False)
    slug = Column(String(128), nullable=False, unique=True, index=True)
    owner_user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    plan_tier = Column(String(64), nullable=False, default="FREE_TIER")
    created_at = Column(DateTime(timezone=True), default=utc_now)


class OrganizationMemberModel(Base):
    __tablename__ = "organization_members"

    id = Column(String(64), primary_key=True)
    organization_id = Column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(64), nullable=False, default="MEMBER")  # OWNER, ADMIN, MEMBER, VIEWER
    created_at = Column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_org_member"),
    )


class WorkspaceModel(Base):
    __tablename__ = "workspaces"

    id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    organization_id = Column(String(64), ForeignKey("organizations.id"), nullable=True, index=True)
    owner_user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(256), nullable=False)
    slug = Column(String(128), nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_personal = Column(Boolean, nullable=False, default=True)
    settings_json = Column(FlexibleJSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class WorkspaceMemberModel(Base):
    __tablename__ = "workspace_members"

    id = Column(String(64), primary_key=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(64), nullable=False, default="OWNER", index=True)  # OWNER, ADMIN, MEMBER, VIEWER
    created_at = Column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        UniqueConstraint("workspace_id", "user_id", name="uq_workspace_member"),
    )


class SessionModel(Base):
    __tablename__ = "sessions"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=True, index=True)
    token_hash = Column(String(128), nullable=False, unique=True, index=True)
    user_agent = Column(String(512), nullable=True)
    ip_address = Column(String(64), nullable=True)
    is_revoked = Column(Boolean, nullable=False, default=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    last_active_at = Column(DateTime(timezone=True), default=utc_now)
    created_at = Column(DateTime(timezone=True), default=utc_now)


# ============================================================================
# DOMAIN 2 — EXTERNAL INTEGRATIONS & GITHUB APP
# ============================================================================


class GitHubInstallationModel(Base):
    __tablename__ = "github_installations"

    id = Column(String(64), primary_key=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    installation_id = Column(String(128), nullable=False, index=True)
    account_login = Column(String(128), nullable=False)
    account_type = Column(String(64), nullable=False, default="User")
    permissions = Column(FlexibleJSON, nullable=False, default=dict)
    status = Column(String(64), nullable=False, default="ACTIVE", index=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class ConnectedRepositoryModel(Base):
    __tablename__ = "connected_repositories"

    id = Column(String(64), primary_key=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    installation_id = Column(String(64), ForeignKey("github_installations.id"), nullable=True, index=True)
    full_name = Column(String(256), nullable=False, index=True)  # e.g. owner/repo
    name = Column(String(128), nullable=False)
    owner = Column(String(128), nullable=False)
    default_branch = Column(String(128), nullable=False, default="main")
    clone_url = Column(String(512), nullable=False)
    html_url = Column(String(512), nullable=False)
    is_private = Column(Boolean, nullable=False, default=False)
    language = Column(String(64), nullable=True)
    repo_metadata = Column(FlexibleJSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class IntegrationCredentialModel(Base):
    __tablename__ = "integration_credentials"

    id = Column(String(64), primary_key=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    provider = Column(String(64), nullable=False, index=True)  # github_app, gemini, s3
    encrypted_payload = Column(Text, nullable=False)
    scopes = Column(FlexibleJSON, nullable=False, default=list)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


# ============================================================================
# DOMAIN 3 — WORKFORCE, AGENTS, MEMORY & TASKS
# ============================================================================


class WorkforceModel(Base):
    __tablename__ = "workforces"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=True, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=True, index=True)
    tenant_id = Column(String(64), nullable=True, index=True)
    repository_id = Column(String(64), ForeignKey("connected_repositories.id"), nullable=True, index=True)
    working_branch = Column(String(128), nullable=True)
    name = Column(String(256), nullable=False)
    objective = Column(Text, nullable=False)
    project_summary = Column(FlexibleJSON, nullable=True)
    status = Column(String(64), nullable=False, default="ACTIVE", index=True)
    simulation_speed = Column(Float, nullable=False, default=1.0)
    is_paused = Column(Boolean, nullable=False, default=False)
    token_budget = Column(Integer, nullable=False, default=100000)
    tokens_used = Column(Integer, nullable=False, default=0)
    llm_calls_made = Column(Integer, nullable=False, default=0)
    max_llm_calls = Column(Integer, nullable=False, default=30)
    final_report = Column(FlexibleJSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class AgentModel(Base):
    __tablename__ = "agents"

    id = Column(String(64), primary_key=True)
    workforce_id = Column(String(64), ForeignKey("workforces.id"), nullable=False, index=True)
    workspace_id = Column(String(64), nullable=True, index=True)
    agent_key = Column(String(64), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    role = Column(String(128), nullable=False)
    department = Column(String(128), nullable=False)
    personality = Column(Text, nullable=False)
    system_instructions = Column(Text, nullable=False)
    capabilities = Column(FlexibleJSON, nullable=False, default=list)
    tools = Column(FlexibleJSON, nullable=False, default=list)
    memory_enabled = Column(Boolean, nullable=False, default=True)
    state = Column(String(64), nullable=False, default="IDLE", index=True)
    current_activity = Column(String(256), nullable=False, default="Standing by at workstation")
    current_room_id = Column(String(64), nullable=False, index=True)
    home_room_id = Column(String(64), nullable=False)
    target_room_id = Column(String(64), nullable=True)
    position_x = Column(Float, nullable=False, default=0.0)
    position_y = Column(Float, nullable=False, default=0.0)
    position_z = Column(Float, nullable=False, default=0.0)
    target_x = Column(Float, nullable=True)
    target_y = Column(Float, nullable=True)
    target_z = Column(Float, nullable=True)
    current_task_id = Column(String(64), nullable=True)
    avatar_config = Column(FlexibleJSON, nullable=False, default=dict)
    max_iterations = Column(Integer, nullable=False, default=5)
    iterations_used = Column(Integer, nullable=False, default=0)
    token_budget = Column(Integer, nullable=False, default=15000)
    tokens_used = Column(Integer, nullable=False, default=0)
    tasks_completed = Column(Integer, nullable=False, default=0)
    tasks_failed = Column(Integer, nullable=False, default=0)
    meetings_attended = Column(Integer, nullable=False, default=0)
    recent_error = Column(Text, nullable=True)
    state_changed_at = Column(DateTime(timezone=True), default=utc_now)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class AgentMemoryModel(Base):
    __tablename__ = "agent_memory"

    id = Column(String(64), primary_key=True)
    agent_id = Column(String(64), ForeignKey("agents.id"), nullable=False, index=True)
    workforce_id = Column(String(64), ForeignKey("workforces.id"), nullable=False, index=True)
    memory_type = Column(String(64), nullable=False, default="OBSERVATION", index=True)
    content = Column(Text, nullable=False)
    importance = Column(Float, nullable=False, default=0.8)
    context_meta = Column(FlexibleJSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class TaskModel(Base):
    __tablename__ = "tasks"

    id = Column(String(64), primary_key=True)
    workforce_id = Column(String(64), ForeignKey("workforces.id"), nullable=False, index=True)
    workspace_id = Column(String(64), nullable=True, index=True)
    execution_id = Column(String(64), nullable=True, index=True)
    title = Column(String(256), nullable=False)
    description = Column(Text, nullable=False)
    assigned_agent_id = Column(String(64), ForeignKey("agents.id"), nullable=True, index=True)
    priority = Column(String(32), nullable=False, default="HIGH")
    status = Column(String(64), nullable=False, default="PENDING", index=True)
    verification_status = Column(String(64), nullable=False, default="PENDING")  # PENDING, VERIFIED, FAILED
    progress = Column(Integer, nullable=False, default=0)
    target_room_id = Column(String(64), nullable=True)
    deliverables = Column(FlexibleJSON, nullable=False, default=list)
    result_summary = Column(Text, nullable=True)
    structured_output = Column(FlexibleJSON, nullable=True)
    execution_history = Column(FlexibleJSON, nullable=False, default=list)
    deadline = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    completed_at = Column(DateTime(timezone=True), nullable=True)


class TaskDependencyModel(Base):
    __tablename__ = "task_dependencies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String(64), ForeignKey("tasks.id"), nullable=False, index=True)
    depends_on_task_id = Column(String(64), ForeignKey("tasks.id"), nullable=False, index=True)


# ============================================================================
# DOMAIN 4 — EXECUTION LIFECYCLE, TOOLS, LEASES & FAIR QUEUE
# ============================================================================


class ExecutionModel(Base):
    __tablename__ = "executions"

    id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=False, index=True)
    workforce_id = Column(String(64), ForeignKey("workforces.id"), nullable=False, index=True)
    agent_id = Column(String(64), ForeignKey("agents.id"), nullable=True, index=True)
    task_id = Column(String(64), ForeignKey("tasks.id"), nullable=True, index=True)
    repository_id = Column(String(64), ForeignKey("connected_repositories.id"), nullable=True, index=True)
    execution_type = Column(String(64), nullable=False, default="WORKFORCE_RUN")  # WORKFORCE_RUN, TASK_RUN, GITHUB_PR, ARTIFACT_GEN
    status = Column(String(64), nullable=False, default="QUEUED", index=True)
    # Valid states: QUEUED, ADMITTED, STARTING, RUNNING, WAITING_FOR_APPROVAL, VERIFYING, COMPLETED, FAILED, CANCELLED
    execution_mode = Column(String(64), nullable=False, default="REAL_TOOL_EXECUTION")  # LIVE_GEMINI, DEMO_SIMULATION, REAL_TOOL_EXECUTION
    working_branch = Column(String(128), nullable=True)
    base_commit = Column(String(128), nullable=True)
    sandbox_path = Column(String(512), nullable=True)
    inputs_json = Column(FlexibleJSON, nullable=False, default=dict)
    outputs_json = Column(FlexibleJSON, nullable=False, default=dict)
    verification_json = Column(FlexibleJSON, nullable=False, default=dict)
    deliverables_json = Column(FlexibleJSON, nullable=False, default=list)
    error_message = Column(Text, nullable=True)
    tokens_used = Column(Integer, nullable=False, default=0)
    duration_ms = Column(Float, nullable=False, default=0.0)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class ExecutionStepModel(Base):
    __tablename__ = "execution_steps"

    id = Column(String(64), primary_key=True)
    execution_id = Column(String(64), ForeignKey("executions.id", ondelete="CASCADE"), nullable=False, index=True)
    step_order = Column(Integer, nullable=False, default=1)
    step_type = Column(String(64), nullable=False)  # PLAN, TOOL_CALL, VERIFY, APPROVAL_GATE, DELIVERABLE
    title = Column(String(256), nullable=False)
    status = Column(String(64), nullable=False, default="RUNNING")
    details = Column(FlexibleJSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class ToolCallModel(Base):
    __tablename__ = "tool_calls"

    id = Column(String(64), primary_key=True)
    execution_id = Column(String(64), ForeignKey("executions.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id = Column(String(64), nullable=False, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    agent_id = Column(String(64), nullable=True, index=True)
    tool_name = Column(String(128), nullable=False, index=True)
    tool_category = Column(String(64), nullable=False)  # github, filesystem, terminal, artifacts, research
    input_payload = Column(FlexibleJSON, nullable=False, default=dict)
    permission_checked = Column(Boolean, nullable=False, default=True)
    status = Column(String(64), nullable=False, default="COMPLETED")
    duration_ms = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class ToolResultModel(Base):
    __tablename__ = "tool_results"

    id = Column(String(64), primary_key=True)
    tool_call_id = Column(String(64), ForeignKey("tool_calls.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    execution_id = Column(String(64), ForeignKey("executions.id", ondelete="CASCADE"), nullable=False, index=True)
    exit_code = Column(Integer, nullable=False, default=0)
    success = Column(Boolean, nullable=False, default=True)
    output_payload = Column(FlexibleJSON, nullable=False, default=dict)
    stdout_text = Column(Text, nullable=True)
    stderr_text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class ExecutionLogModel(Base):
    __tablename__ = "execution_logs"

    id = Column(String(64), primary_key=True)
    execution_id = Column(String(64), ForeignKey("executions.id", ondelete="CASCADE"), nullable=False, index=True)
    level = Column(String(32), nullable=False, default="INFO")
    source = Column(String(64), nullable=False, default="runtime")
    message = Column(Text, nullable=False)
    meta_json = Column(FlexibleJSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class ExecutionApprovalModel(Base):
    __tablename__ = "execution_approvals"

    id = Column(String(64), primary_key=True)
    execution_id = Column(String(64), ForeignKey("executions.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id = Column(String(64), nullable=False, index=True)
    requested_by_agent_id = Column(String(64), nullable=True)
    action_type = Column(String(64), nullable=False)  # CREATE_PULL_REQUEST, EXTERNAL_PUBLISH, EXPENSIVE_OP
    title = Column(String(256), nullable=False)
    description = Column(Text, nullable=False)
    diff_preview = Column(Text, nullable=True)
    payload = Column(FlexibleJSON, nullable=False, default=dict)
    status = Column(String(64), nullable=False, default="PENDING", index=True)  # PENDING, APPROVED, REJECTED
    decided_by_user_id = Column(String(64), nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class ExecutionLeaseModel(Base):
    __tablename__ = "execution_leases"

    id = Column(String(64), primary_key=True)
    execution_id = Column(String(64), ForeignKey("executions.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    workspace_id = Column(String(64), nullable=False, index=True)
    worker_id = Column(String(128), nullable=False, index=True)
    status = Column(String(64), nullable=False, default="ACTIVE", index=True)  # ACTIVE, RELEASED, RECOVERED, EXPIRED
    heartbeat_at = Column(DateTime(timezone=True), default=utc_now, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    acquired_at = Column(DateTime(timezone=True), default=utc_now)
    released_at = Column(DateTime(timezone=True), nullable=True)


class ExecutionQueueModel(Base):
    __tablename__ = "execution_queue"

    id = Column(String(64), primary_key=True)
    execution_id = Column(String(64), ForeignKey("executions.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    workforce_id = Column(String(64), ForeignKey("workforces.id"), nullable=False, index=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=False, index=True)
    priority = Column(Integer, nullable=False, default=10, index=True)
    status = Column(String(64), nullable=False, default="QUEUED", index=True)  # QUEUED, ADMITTED, RUNNING, COMPLETED, FAILED, CANCELLED
    idempotency_key = Column(String(128), nullable=True, unique=True, index=True)
    retry_count = Column(Integer, nullable=False, default=0)
    max_retries = Column(Integer, nullable=False, default=2)
    queued_at = Column(DateTime(timezone=True), default=utc_now, index=True)
    admitted_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)


# ============================================================================
# DOMAIN 5 — COLLABORATION & BOARDROOM MEETINGS
# ============================================================================


class MeetingModel(Base):
    __tablename__ = "meetings"

    id = Column(String(64), primary_key=True)
    workforce_id = Column(String(64), ForeignKey("workforces.id"), nullable=False, index=True)
    workspace_id = Column(String(64), nullable=True, index=True)
    title = Column(String(256), nullable=False)
    agenda = Column(FlexibleJSON, nullable=False, default=list)
    room_id = Column(String(64), nullable=False, default="boardroom", index=True)
    initiator_agent_id = Column(String(64), ForeignKey("agents.id"), nullable=False)
    status = Column(String(64), nullable=False, default="SCHEDULED", index=True)
    active_speaker_id = Column(String(64), nullable=True)
    active_presentation_id = Column(String(64), nullable=True)
    is_observed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)


class MeetingParticipantModel(Base):
    __tablename__ = "meeting_participants"

    id = Column(Integer, primary_key=True, autoincrement=True)
    meeting_id = Column(String(64), ForeignKey("meetings.id"), nullable=False, index=True)
    agent_id = Column(String(64), ForeignKey("agents.id"), nullable=False, index=True)
    seat_index = Column(Integer, nullable=False, default=0)
    seat_x = Column(Float, nullable=False, default=0.0)
    seat_y = Column(Float, nullable=False, default=0.0)
    seat_z = Column(Float, nullable=False, default=0.0)
    joined_at = Column(DateTime(timezone=True), nullable=True)


class MeetingMessageModel(Base):
    __tablename__ = "meeting_messages"

    id = Column(String(64), primary_key=True)
    meeting_id = Column(String(64), ForeignKey("meetings.id"), nullable=False, index=True)
    sender_agent_id = Column(String(64), ForeignKey("agents.id"), nullable=False, index=True)
    sender_name = Column(String(128), nullable=False)
    sender_role = Column(String(128), nullable=False)
    message_type = Column(String(64), nullable=False, default="DISCUSSION")
    content = Column(Text, nullable=False)
    round_number = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class MeetingPresentationModel(Base):
    __tablename__ = "meeting_presentations"

    id = Column(String(64), primary_key=True)
    meeting_id = Column(String(64), ForeignKey("meetings.id"), nullable=False, index=True)
    presenter_agent_id = Column(String(64), ForeignKey("agents.id"), nullable=False, index=True)
    presenter_name = Column(String(128), nullable=False)
    presenter_role = Column(String(128), nullable=False)
    presentation_type = Column(String(64), nullable=False)
    title = Column(String(256), nullable=False)
    subtitle = Column(String(256), nullable=True)
    structured_data = Column(FlexibleJSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class MeetingDecisionModel(Base):
    __tablename__ = "meeting_decisions"

    id = Column(String(64), primary_key=True)
    meeting_id = Column(String(64), ForeignKey("meetings.id"), nullable=False, index=True)
    workforce_id = Column(String(64), ForeignKey("workforces.id"), nullable=False, index=True)
    title = Column(String(256), nullable=False)
    rationale = Column(Text, nullable=False)
    owner_agent_id = Column(String(64), nullable=True)
    owner_name = Column(String(128), nullable=True)
    action_items = Column(FlexibleJSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), default=utc_now)


# ============================================================================
# DOMAIN 6 — UNIVERSAL ARTIFACTS & VERSIONING
# ============================================================================


class ArtifactModel(Base):
    __tablename__ = "artifacts"

    id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=False, index=True)
    workforce_id = Column(String(64), ForeignKey("workforces.id"), nullable=True, index=True)
    task_id = Column(String(64), ForeignKey("tasks.id"), nullable=True, index=True)
    execution_id = Column(String(64), ForeignKey("executions.id"), nullable=True, index=True)
    agent_id = Column(String(64), ForeignKey("agents.id"), nullable=True, index=True)
    filename = Column(String(256), nullable=False)
    artifact_type = Column(String(64), nullable=False, index=True)  # PPTX, DOCX, XLSX, PDF, CSV, MARKDOWN, SOURCE_CODE, ZIP, SVG, PNG
    mime_type = Column(String(128), nullable=False)
    storage_key = Column(String(512), nullable=False)
    file_size = Column(Integer, nullable=False, default=0)
    checksum_sha256 = Column(String(128), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    validation_status = Column(String(64), nullable=False, default="VALID")  # VALID, INVALID, PENDING
    summary_metadata = Column(FlexibleJSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class ArtifactVersionModel(Base):
    __tablename__ = "artifact_versions"

    id = Column(String(64), primary_key=True)
    artifact_id = Column(String(64), ForeignKey("artifacts.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    storage_key = Column(String(512), nullable=False)
    file_size = Column(Integer, nullable=False, default=0)
    checksum_sha256 = Column(String(128), nullable=False)
    change_note = Column(String(256), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


# ============================================================================
# DOMAIN 7 — INFRASTRUCTURE, TELEMETRY, BUDGETS & AUDIT LOGS
# ============================================================================


class AgentEventModel(Base):
    __tablename__ = "agent_events"

    id = Column(String(64), primary_key=True)
    sequence = Column(Integer, nullable=False, index=True)
    workforce_id = Column(String(64), ForeignKey("workforces.id"), nullable=False, index=True)
    event_type = Column(String(64), nullable=False, index=True)
    entity_id = Column(String(64), nullable=False, index=True)
    payload = Column(FlexibleJSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        Index("ix_agent_events_workforce_seq", "workforce_id", "sequence"),
    )


class LLMRequestModel(Base):
    __tablename__ = "llm_requests"

    id = Column(String(64), primary_key=True)
    workforce_id = Column(String(64), ForeignKey("workforces.id"), nullable=False, index=True)
    user_id = Column(String(64), nullable=True, index=True)
    workspace_id = Column(String(64), nullable=True, index=True)
    agent_id = Column(String(64), nullable=True, index=True)
    model_id = Column(String(128), nullable=False)
    operation = Column(String(128), nullable=False)
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    duration_ms = Column(Float, nullable=False, default=0.0)
    estimated_cost_usd = Column(Float, nullable=True)
    success = Column(Boolean, nullable=False, default=True)
    is_live_api = Column(Boolean, nullable=False, default=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class TokenUsageModel(Base):
    __tablename__ = "token_usage"

    id = Column(String(64), primary_key=True)
    workforce_id = Column(String(64), ForeignKey("workforces.id"), nullable=False, index=True)
    user_id = Column(String(64), nullable=True, index=True)
    workspace_id = Column(String(64), nullable=True, index=True)
    agent_id = Column(String(64), nullable=True, index=True)
    model_id = Column(String(128), nullable=False)
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    estimated_cost_usd = Column(Float, nullable=False, default=0.0)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class UsageRecordModel(Base):
    __tablename__ = "usage_records"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=False, index=True)
    workforce_id = Column(String(64), nullable=True, index=True)
    resource_type = Column(String(64), nullable=False, index=True)  # LLM_TOKENS, TOOL_EXECUTION, SANDBOX_SECONDS, ARTIFACT_BYTES
    quantity = Column(Float, nullable=False, default=0.0)
    unit = Column(String(32), nullable=False, default="count")
    meta_json = Column(FlexibleJSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class ResourceBudgetModel(Base):
    __tablename__ = "resource_budgets"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=False, index=True)
    max_tokens_per_day = Column(Integer, nullable=False, default=250000)
    tokens_used_today = Column(Integer, nullable=False, default=0)
    max_concurrent_executions = Column(Integer, nullable=False, default=1)
    max_queued_executions = Column(Integer, nullable=False, default=3)
    max_storage_bytes = Column(Integer, nullable=False, default=524_288_000)  # 500 MB
    storage_bytes_used = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    user_id = Column(String(64), nullable=True, index=True)
    workspace_id = Column(String(64), nullable=True, index=True)
    actor_type = Column(String(32), nullable=False, default="USER")  # USER, AGENT, SYSTEM
    actor_id = Column(String(64), nullable=False)
    action = Column(String(128), nullable=False, index=True)
    resource_type = Column(String(64), nullable=False)
    resource_id = Column(String(128), nullable=False)
    status = Column(String(32), nullable=False, default="ALLOWED")  # ALLOWED, DENIED, COMPLETED, FAILED
    details = Column(FlexibleJSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now)
