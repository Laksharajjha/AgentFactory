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

export interface WorldSnapshot {
  workforce_id: string;
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
}
