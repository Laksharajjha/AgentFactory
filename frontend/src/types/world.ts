import { AgentProfile } from './agent';
import { WorldEvent } from './event';
import { MeetingDecision, MeetingPresentation, MeetingSession } from './meeting';
import { TaskItem } from './task';

export interface RoomDefinition {
  id: string;
  name: string;
  floor: number;
  y: number;
  bounds: {
    x: number;
    z: number;
    width: number;
    depth: number;
  };
  entry_point: [number, number, number];
  workstation: [number, number, number];
  accent_color: string;
  description: string;
  displays: string[];
  seats?: Array<[number, number, number]>;
  podium_point?: [number, number, number];
}

export interface TokenUsageSummary {
  workforce_id: string;
  global_token_budget: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens_used: number;
  llm_calls_made: number;
  max_llm_calls: number;
  live_api_calls: number;
  fallback_calls: number;
  estimated_cost_usd: number;
  provider_status: string;
  active_model: string;
  by_agent: Array<{
    agent_id: string;
    agent_name: string;
    role: string;
    tokens_used: number;
    token_budget: number;
    utilization_pct: number;
    iterations_used: number;
    max_iterations: number;
  }>;
  recent_requests: Array<{
    id: string;
    agent_id?: string | null;
    model_id: string;
    operation: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    duration_ms: number;
    estimated_cost_usd?: number | null;
    is_live_api: boolean;
    success: boolean;
    created_at: string;
  }>;
}

export interface CeoOverview {
  orchestrator: string;
  office_room_id: string;
  company_health_score: number;
  company_health_status: string;
  active_project: {
    id: string;
    name: string;
    objective: string;
    status: string;
  };
  employee_workload: Array<{
    agent_id: string;
    name: string;
    role: string;
    state: string;
    room_id: string;
    tasks_completed: number;
    tokens_used: number;
    token_budget: number;
  }>;
  pending_decisions: string[];
  ratified_decisions: MeetingDecision[];
  major_risks: string[];
  token_expenditure: {
    used: number;
    budget: number;
    calls_made: number;
    max_calls: number;
    estimated_cost_usd: number;
  };
  completed_deliverables: Array<{
    task_title: string;
    agent?: string | null;
    deliverables: string[];
    summary?: string | null;
  }>;
}

export interface ProjectSummary {
  archive_name?: string;
  file_count?: number;
  skipped_files?: number;
  total_lines_of_code?: number;
  languages?: string[];
  frameworks?: string[];
  sample_files?: Array<{ path: string; lines: number; size_bytes: number }>;
  architectural_signals?: string[];
}

export interface ArtifactItem {
  id: string;
  tenant_id: string;
  user_id: string;
  workspace_id: string;
  workforce_id?: string | null;
  task_id?: string | null;
  execution_id?: string | null;
  agent_id?: string | null;
  filename: string;
  artifact_type: string;
  mime_type: string;
  storage_key: string;
  file_size: number;
  checksum_sha256: string;
  version: number;
  validation_status: string;
  summary_metadata: Record<string, unknown>;
  download_url: string;
  download_expires_at: number;
  created_at: string;
}

export interface ExecutionItem {
  id: string;
  workforce_id: string;
  workspace_id: string;
  user_id: string;
  execution_type: string;
  status: string;
  execution_mode: string;
  working_branch?: string | null;
  base_commit?: string | null;
  tokens_used: number;
  duration_ms: number;
  verification: Record<string, unknown>;
  deliverables: Array<Record<string, unknown>>;
  error_message?: string | null;
  created_at: string;
  completed_at?: string | null;
  tool_calls: Array<{
    id: string;
    tool_name: string;
    category: string;
    status: string;
    duration_ms: number;
    created_at: string;
  }>;
  approvals: Array<{
    id: string;
    action_type: string;
    title: string;
    description: string;
    diff_preview?: string | null;
    status: string;
    created_at: string;
  }>;
}

export interface QueueItem {
  id: string;
  execution_id: string;
  workforce_id: string;
  user_id: string;
  workspace_id: string;
  status: string;
  queue_position?: number | null;
  retry_count: number;
  queued_at: string;
  admitted_at?: string | null;
  completed_at?: string | null;
}

export interface ConnectedRepoItem {
  id: string;
  workspace_id: string;
  user_id: string;
  installation_id?: string | null;
  full_name: string;
  name: string;
  owner: string;
  default_branch: string;
  clone_url: string;
  html_url: string;
  is_private: boolean;
  language?: string | null;
  repo_metadata: {
    branches?: string[];
    open_prs?: Array<{
      number: number;
      title: string;
      head: string;
      base: string;
      status: string;
      auto_merged: boolean;
      url: string;
      diff_lines: number;
      created_at: string;
    }>;
  };
  created_at: string;
}

export interface SystemCapacity {
  authenticated_users: number;
  active_sessions: number;
  websocket_connections: number;
  active_executions: number;
  queued_executions: number;
  available_execution_slots: number;
  max_concurrent_workforces: number;
  max_concurrent_executions_per_user: number;
  max_queued_workforces_per_user: number;
  max_global_queued_workforces: number;
  max_agents_per_workforce: number;
  max_sandboxes: number;
  max_execution_duration_seconds: number;
  admission_paused: boolean;
  active_agent_tasks: number;
  active_sandboxes: number;
  queue_utilization_pct: number;
  api_memory_mb: number;
  api_cpu_seconds: number;
  worker_memory_mb: number;
  worker_cpu_seconds: number;
  db_pool_size: number;
  gemini_rate_limits: Record<string, unknown>;
  storage_bytes_used: number;
}

export interface WorldSnapshot {
  workforce_id: string;
  workspace_id?: string | null;
  workforce_name: string;
  objective: string;
  workforce_status: string;
  simulation_speed: number;
  is_paused: boolean;
  project_summary?: ProjectSummary | null;
  final_report?: Record<string, unknown> | null;
  rooms: RoomDefinition[];
  agents: AgentProfile[];
  tasks: TaskItem[];
  meetings: MeetingSession[];
  active_meeting?: MeetingSession | null;
  active_presentation?: MeetingPresentation | null;
  token_usage: TokenUsageSummary;
  recent_events: WorldEvent[];
  ceo_overview: CeoOverview;
  artifacts?: ArtifactItem[];
  executions?: ExecutionItem[];
  queue_items?: QueueItem[];
  connected_repositories?: ConnectedRepoItem[];
  system_capacity?: SystemCapacity | null;
}
