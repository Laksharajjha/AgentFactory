from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

AgentStateLiteral = Literal[
    "IDLE",
    "TASK_ASSIGNED",
    "PLANNING",
    "WORKING",
    "NEEDS_COLLABORATION",
    "MOVING",
    "IN_MEETING",
    "PRESENTING",
    "WAITING",
    "COMPLETED",
    "FAILED",
    "PAUSED",
]

EventTypeLiteral = Literal[
    "AGENT_CREATED",
    "AGENT_TASK_ASSIGNED",
    "AGENT_STATE_CHANGED",
    "AGENT_LOCATION_CHANGED",
    "AGENT_MOVEMENT_REQUESTED",
    "AGENT_WORK_STARTED",
    "AGENT_WORK_COMPLETED",
    "AGENT_MESSAGE_CREATED",
    "MEETING_REQUESTED",
    "MEETING_STARTED",
    "MEETING_PARTICIPANT_JOINED",
    "MEETING_MESSAGE_CREATED",
    "MEETING_PRESENTATION_UPDATED",
    "MEETING_DECISION_CREATED",
    "MEETING_ENDED",
    "TASK_CREATED",
    "TASK_COMPLETED",
    "TASK_FAILED",
    "TOKEN_USAGE_UPDATED",
    "WORKFORCE_COMPLETED",
    "EXECUTION_QUEUED",
    "EXECUTION_ADMITTED",
    "EXECUTION_STARTED",
    "EXECUTION_WAITING",
    "EXECUTION_COMPLETED",
    "EXECUTION_FAILED",
    "EXECUTION_CANCELLED",
    "QUEUE_POSITION_UPDATED",
    "CAPACITY_CHANGED",
    "ARTIFACT_GENERATED",
]

PresentationTypeLiteral = Literal[
    "ARCHITECTURE_DIAGRAM",
    "TASK_BREAKDOWN",
    "CODE_SNIPPET",
    "BUG_REPORT",
    "RESEARCH_FINDINGS",
    "PROGRESS_REPORT",
    "DECISIONS",
    "RISK_ASSESSMENT",
]


class AgentDefinitionSchema(BaseModel):
    id: str
    name: str
    role: str
    department: str
    personality: str
    system_instructions: str
    capabilities: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    memory_enabled: bool = True
    max_iterations: int = 5
    token_budget: int = 15000
    home_room_id: str = "ceo_office"


class AgentMessageSchema(BaseModel):
    sender_id: str
    recipient_id: str
    message_type: str
    task_id: Optional[str] = None
    content: str
    timestamp: str


class AgentMemorySchema(BaseModel):
    id: str
    agent_id: str
    memory_type: str
    content: str
    importance: float
    context_meta: Optional[Dict[str, Any]] = None
    created_at: datetime


class AgentProfileSchema(BaseModel):
    id: str
    workforce_id: str
    agent_key: str
    name: str
    role: str
    department: str
    personality: str
    system_instructions: str
    capabilities: List[str]
    tools: List[str]
    memory_enabled: bool
    state: AgentStateLiteral
    current_activity: str
    current_room_id: str
    home_room_id: str
    target_room_id: Optional[str] = None
    position: List[float]
    target_position: Optional[List[float]] = None
    current_task_id: Optional[str] = None
    avatar_config: Dict[str, Any]
    max_iterations: int
    iterations_used: int
    token_budget: int
    tokens_used: int
    tasks_completed: int
    tasks_failed: int
    meetings_attended: int
    recent_error: Optional[str] = None
    state_changed_at: datetime
    memories: List[AgentMemorySchema] = Field(default_factory=list)


class TaskSchema(BaseModel):
    id: str
    workforce_id: str
    title: str
    description: str
    assigned_agent_id: Optional[str] = None
    assigned_agent_name: Optional[str] = None
    priority: str
    status: str
    progress: int
    target_room_id: Optional[str] = None
    dependencies: List[str] = Field(default_factory=list)
    deliverables: List[str] = Field(default_factory=list)
    result_summary: Optional[str] = None
    structured_output: Optional[Dict[str, Any]] = None
    execution_history: List[Dict[str, Any]] = Field(default_factory=list)
    deadline: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


class MeetingParticipantSchema(BaseModel):
    agent_id: str
    agent_name: str
    agent_role: str
    seat_index: int
    seat_position: List[float]
    joined_at: Optional[datetime] = None


class MeetingMessageSchema(BaseModel):
    id: str
    meeting_id: str
    sender_agent_id: str
    sender_name: str
    sender_role: str
    message_type: str
    content: str
    round_number: int
    created_at: datetime


class MeetingPresentationSchema(BaseModel):
    id: str
    meeting_id: str
    presenter_agent_id: str
    presenter_name: str
    presenter_role: str
    presentation_type: PresentationTypeLiteral
    title: str
    subtitle: Optional[str] = None
    structured_data: Dict[str, Any]
    created_at: datetime


class MeetingDecisionSchema(BaseModel):
    id: str
    meeting_id: str
    title: str
    rationale: str
    owner_agent_id: Optional[str] = None
    owner_name: Optional[str] = None
    action_items: List[str] = Field(default_factory=list)
    created_at: datetime


class MeetingSchema(BaseModel):
    id: str
    workforce_id: str
    title: str
    agenda: List[str]
    room_id: str
    initiator_agent_id: str
    status: str
    active_speaker_id: Optional[str] = None
    active_presentation_id: Optional[str] = None
    is_observed: bool = False
    participants: List[MeetingParticipantSchema] = Field(default_factory=list)
    messages: List[MeetingMessageSchema] = Field(default_factory=list)
    presentations: List[MeetingPresentationSchema] = Field(default_factory=list)
    decisions: List[MeetingDecisionSchema] = Field(default_factory=list)
    created_at: datetime
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


class WorldEventSchema(BaseModel):
    event_id: str
    sequence: int
    workforce_id: str
    event_type: EventTypeLiteral
    entity_id: str
    payload: Dict[str, Any]
    timestamp: datetime


class TokenUsageSummarySchema(BaseModel):
    workforce_id: str
    global_token_budget: int
    total_input_tokens: int
    total_output_tokens: int
    total_tokens_used: int
    llm_calls_made: int
    max_llm_calls: int
    live_api_calls: int
    fallback_calls: int
    estimated_cost_usd: float
    provider_status: str
    active_model: str
    by_agent: List[Dict[str, Any]] = Field(default_factory=list)
    recent_requests: List[Dict[str, Any]] = Field(default_factory=list)


class WorkforceCreateRequest(BaseModel):
    name: str = Field(default="Project Forge Initiative")
    objective: str = Field(..., min_length=5)
    auto_deploy: bool = True
    repository_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    project_context: Optional[Dict[str, Any]] = None


class AuthRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2)
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=6)
    role_title: str = "Engineering Lead"


class AuthLoginRequest(BaseModel):
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=4)


class OAuthLoginRequest(BaseModel):
    provider: str = "github"
    email: str
    name: str = "Developer"


class ArtifactCreateRequest(BaseModel):
    artifact_type: str = "PPTX"
    title: str
    filename: Optional[str] = None
    workforce_id: Optional[str] = None
    task_id: Optional[str] = None
    structured_content: Dict[str, Any] = Field(default_factory=dict)


class GitHubConnectRequest(BaseModel):
    account_login: str = "Laksharajjha"
    installation_id: Optional[str] = None
    access_token: Optional[str] = None
    repositories: Optional[List[Dict[str, Any]]] = None


class GitHubBranchActionRequest(BaseModel):
    execution_id: str
    branch_name: str
    file_path: str = "src/auth_middleware.py"
    file_content: Optional[str] = None
    commit_message: str = "feat: autonomous code modification on isolated working branch"


class ExecutionApprovalDecisionRequest(BaseModel):
    decision: Literal["APPROVED", "REJECTED"]
    comment: Optional[str] = None


class AdminGovernorUpdateRequest(BaseModel):
    max_concurrent_workforces: Optional[int] = None
    max_concurrent_executions_per_user: Optional[int] = None
    max_queued_workforces_per_user: Optional[int] = None
    max_global_queued_workforces: Optional[int] = None
    max_agents_per_workforce: Optional[int] = None
    max_execution_duration_seconds: Optional[int] = None
    admission_paused: Optional[bool] = None


class AgentInstructionRequest(BaseModel):
    instruction: str = Field(..., min_length=2)
    assign_as_task: bool = False
    priority: str = "HIGH"


class SimulationControlRequest(BaseModel):
    speed: Optional[float] = None
    is_paused: Optional[bool] = None


class LLMConfigUpdateRequest(BaseModel):
    provider: str = "gemini"
    workspace_id: Optional[str] = None
    gemini_api_key: Optional[str] = None
    api_key: Optional[str] = None
    gemini_model: Optional[str] = None
    selected_model: Optional[str] = None
    enable_complex_model: Optional[bool] = None
    enable_live_execution: Optional[bool] = None
    validate_before_save: bool = False


class LLMTestCredentialRequest(BaseModel):
    provider: str = "gemini"
    workspace_id: Optional[str] = None
    api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    selected_model: Optional[str] = None
    gemini_model: Optional[str] = None


class LLMModelSelectionRequest(BaseModel):
    provider: str = "gemini"
    workspace_id: Optional[str] = None
    selected_model: Optional[str] = None
    gemini_model: Optional[str] = None
    enable_complex_model: Optional[bool] = None
    enable_live_execution: Optional[bool] = None


class WorldSnapshotSchema(BaseModel):
    workforce_id: str
    workspace_id: Optional[str] = None
    workforce_name: str
    objective: str
    workforce_status: str
    simulation_speed: float
    is_paused: bool
    project_summary: Optional[Dict[str, Any]] = None
    final_report: Optional[Dict[str, Any]] = None
    rooms: List[Dict[str, Any]]
    agents: List[AgentProfileSchema]
    tasks: List[TaskSchema]
    meetings: List[MeetingSchema]
    active_meeting: Optional[MeetingSchema] = None
    active_presentation: Optional[MeetingPresentationSchema] = None
    token_usage: TokenUsageSummarySchema
    recent_events: List[WorldEventSchema]
    ceo_overview: Dict[str, Any]
    artifacts: List[Dict[str, Any]] = Field(default_factory=list)
    executions: List[Dict[str, Any]] = Field(default_factory=list)
    queue_items: List[Dict[str, Any]] = Field(default_factory=list)
    connected_repositories: List[Dict[str, Any]] = Field(default_factory=list)
    system_capacity: Optional[Dict[str, Any]] = None
