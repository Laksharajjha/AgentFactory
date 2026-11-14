export type PresentationType =
  | 'ARCHITECTURE_DIAGRAM'
  | 'TASK_BREAKDOWN'
  | 'CODE_SNIPPET'
  | 'BUG_REPORT'
  | 'RESEARCH_FINDINGS'
  | 'PROGRESS_REPORT'
  | 'DECISIONS'
  | 'RISK_ASSESSMENT';

export interface MeetingParticipant {
  agent_id: string;
  agent_name: string;
  agent_role: string;
  seat_index: number;
  seat_position: [number, number, number];
  joined_at?: string | null;
}

export interface MeetingMessage {
  id: string;
  meeting_id: string;
  sender_agent_id: string;
  sender_name: string;
  sender_role: string;
  message_type: 'DISCUSSION' | 'EVIDENCE' | 'CHALLENGE' | 'QUESTION' | 'PROPOSAL' | 'DECISION' | string;
  content: string;
  round_number: number;
  created_at: string;
}

export interface MeetingPresentation {
  id: string;
  meeting_id: string;
  presenter_agent_id: string;
  presenter_name: string;
  presenter_role: string;
  presentation_type: PresentationType;
  title: string;
  subtitle?: string | null;
  structured_data: Record<string, unknown>;
  created_at: string;
}

export interface MeetingDecision {
  id: string;
  meeting_id: string;
  title: string;
  rationale: string;
  owner_agent_id?: string | null;
  owner_name?: string | null;
  action_items: string[];
  created_at: string;
}

export interface MeetingSession {
  id: string;
  workforce_id: string;
  title: string;
  agenda: string[];
  room_id: string;
  initiator_agent_id: string;
  status: 'SCHEDULED' | 'GATHERING' | 'ACTIVE' | 'PRESENTING' | 'COMPLETED' | string;
  active_speaker_id?: string | null;
  active_presentation_id?: string | null;
  is_observed: boolean;
  participants: MeetingParticipant[];
  messages: MeetingMessage[];
  presentations: MeetingPresentation[];
  decisions: MeetingDecision[];
  created_at: string;
  started_at?: string | null;
  ended_at?: string | null;
}
