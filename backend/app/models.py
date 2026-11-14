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
)
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class UserModel(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False)
    role = Column(String(64), default="Director")
    created_at = Column(DateTime(timezone=True), default=utc_now)


class WorkforceModel(Base):
    __tablename__ = "workforces"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String(256), nullable=False)
    objective = Column(Text, nullable=False)
    project_summary = Column(JSON, nullable=True)
    status = Column(String(64), nullable=False, default="ACTIVE", index=True)
    simulation_speed = Column(Float, nullable=False, default=1.0)
    is_paused = Column(Boolean, nullable=False, default=False)
    token_budget = Column(Integer, nullable=False, default=100000)
    tokens_used = Column(Integer, nullable=False, default=0)
    llm_calls_made = Column(Integer, nullable=False, default=0)
    max_llm_calls = Column(Integer, nullable=False, default=30)
    final_report = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class AgentModel(Base):
    __tablename__ = "agents"

    id = Column(String(64), primary_key=True)
    workforce_id = Column(String(64), ForeignKey("workforces.id"), nullable=False, index=True)
    agent_key = Column(String(64), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    role = Column(String(128), nullable=False)
    department = Column(String(128), nullable=False)
    personality = Column(Text, nullable=False)
    system_instructions = Column(Text, nullable=False)
    capabilities = Column(JSON, nullable=False, default=list)
    tools = Column(JSON, nullable=False, default=list)
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
    avatar_config = Column(JSON, nullable=False, default=dict)
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
    memory_type = Column(String(64), nullable=False, default="OBSERVATION", index=True)  # OBSERVATION, DECISION, SUMMARY, INSTRUCTION
    content = Column(Text, nullable=False)
    importance = Column(Float, nullable=False, default=0.8)
    context_meta = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class TaskModel(Base):
    __tablename__ = "tasks"

    id = Column(String(64), primary_key=True)
    workforce_id = Column(String(64), ForeignKey("workforces.id"), nullable=False, index=True)
    title = Column(String(256), nullable=False)
    description = Column(Text, nullable=False)
    assigned_agent_id = Column(String(64), ForeignKey("agents.id"), nullable=True, index=True)
    priority = Column(String(32), nullable=False, default="HIGH")  # CRITICAL, HIGH, MEDIUM, LOW
    status = Column(String(64), nullable=False, default="PENDING", index=True)  # PENDING, IN_PROGRESS, COMPLETED, FAILED, BLOCKED
    progress = Column(Integer, nullable=False, default=0)
    target_room_id = Column(String(64), nullable=True)
    deliverables = Column(JSON, nullable=False, default=list)
    result_summary = Column(Text, nullable=True)
    structured_output = Column(JSON, nullable=True)
    execution_history = Column(JSON, nullable=False, default=list)
    deadline = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    completed_at = Column(DateTime(timezone=True), nullable=True)


class TaskDependencyModel(Base):
    __tablename__ = "task_dependencies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String(64), ForeignKey("tasks.id"), nullable=False, index=True)
    depends_on_task_id = Column(String(64), ForeignKey("tasks.id"), nullable=False, index=True)


class MeetingModel(Base):
    __tablename__ = "meetings"

    id = Column(String(64), primary_key=True)
    workforce_id = Column(String(64), ForeignKey("workforces.id"), nullable=False, index=True)
    title = Column(String(256), nullable=False)
    agenda = Column(JSON, nullable=False, default=list)
    room_id = Column(String(64), nullable=False, default="boardroom", index=True)
    initiator_agent_id = Column(String(64), ForeignKey("agents.id"), nullable=False)
    status = Column(String(64), nullable=False, default="SCHEDULED", index=True)  # SCHEDULED, GATHERING, ACTIVE, PRESENTING, COMPLETED
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
    message_type = Column(String(64), nullable=False, default="DISCUSSION")  # DISCUSSION, EVIDENCE, CHALLENGE, QUESTION, PROPOSAL, DECISION
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
    presentation_type = Column(String(64), nullable=False)  # ARCHITECTURE_DIAGRAM, TASK_BREAKDOWN, CODE_SNIPPET, BUG_REPORT, RESEARCH_FINDINGS, PROGRESS_REPORT, DECISIONS, RISK_ASSESSMENT
    title = Column(String(256), nullable=False)
    subtitle = Column(String(256), nullable=True)
    structured_data = Column(JSON, nullable=False, default=dict)
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
    action_items = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class AgentEventModel(Base):
    __tablename__ = "agent_events"

    id = Column(String(64), primary_key=True)
    sequence = Column(Integer, nullable=False, index=True)
    workforce_id = Column(String(64), ForeignKey("workforces.id"), nullable=False, index=True)
    event_type = Column(String(64), nullable=False, index=True)
    entity_id = Column(String(64), nullable=False, index=True)
    payload = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        Index("ix_agent_events_workforce_seq", "workforce_id", "sequence"),
    )


class LLMRequestModel(Base):
    __tablename__ = "llm_requests"

    id = Column(String(64), primary_key=True)
    workforce_id = Column(String(64), ForeignKey("workforces.id"), nullable=False, index=True)
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
    agent_id = Column(String(64), nullable=True, index=True)
    model_id = Column(String(128), nullable=False)
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    estimated_cost_usd = Column(Float, nullable=False, default=0.0)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
