export type AgentState =
  | 'IDLE'
  | 'TASK_ASSIGNED'
  | 'PLANNING'
  | 'WORKING'
  | 'NEEDS_COLLABORATION'
  | 'MOVING'
  | 'IN_MEETING'
  | 'PRESENTING'
  | 'WAITING'
  | 'COMPLETED'
  | 'FAILED'
  | 'PAUSED';

export interface AgentAvatarConfig {
  suit_color: string;
  shirt_color: string;
  accent_color: string;
  hair_color: string;
  skin_color: string;
  hair_style: string;
  badge: string;
}

export interface AgentMemory {
  id: string;
  agent_id: string;
  memory_type: 'OBSERVATION' | 'DECISION' | 'SUMMARY' | 'INSTRUCTION' | string;
  content: string;
  importance: number;
  context_meta?: Record<string, unknown>;
  created_at: string;
}

export interface AgentProfile {
  id: string;
  workforce_id: string;
  agent_key: string;
  name: string;
  role: string;
  department: string;
  personality: string;
  system_instructions: string;
  capabilities: string[];
  tools: string[];
  memory_enabled: boolean;
  state: AgentState;
  current_activity: string;
  current_room_id: string;
  home_room_id: string;
  target_room_id?: string | null;
  position: [number, number, number];
  target_position?: [number, number, number] | null;
  current_task_id?: string | null;
  avatar_config: AgentAvatarConfig;
  max_iterations: number;
  iterations_used: number;
  token_budget: number;
  tokens_used: number;
  tasks_completed: number;
  tasks_failed: number;
  meetings_attended: number;
  recent_error?: string | null;
  state_changed_at: string;
  memories: AgentMemory[];
}
