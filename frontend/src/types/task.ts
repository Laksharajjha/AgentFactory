export interface TaskItem {
  id: string;
  workforce_id: string;
  title: string;
  description: string;
  assigned_agent_id?: string | null;
  assigned_agent_name?: string | null;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'BLOCKED' | string;
  progress: number;
  target_room_id?: string | null;
  dependencies: string[];
  deliverables: string[];
  result_summary?: string | null;
  structured_output?: Record<string, unknown> | null;
  execution_history: Array<{
    timestamp: string;
    event: string;
    agent?: string;
    room?: string;
    summary?: string;
    tokens_used?: number;
    error?: string;
  }>;
  deadline?: string | null;
  created_at: string;
  completed_at?: string | null;
}
