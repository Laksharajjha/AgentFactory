export type WorldEventType =
  | 'AGENT_CREATED'
  | 'AGENT_TASK_ASSIGNED'
  | 'AGENT_STATE_CHANGED'
  | 'AGENT_LOCATION_CHANGED'
  | 'AGENT_MOVEMENT_REQUESTED'
  | 'AGENT_WORK_STARTED'
  | 'AGENT_WORK_COMPLETED'
  | 'AGENT_MESSAGE_CREATED'
  | 'MEETING_REQUESTED'
  | 'MEETING_STARTED'
  | 'MEETING_PARTICIPANT_JOINED'
  | 'MEETING_MESSAGE_CREATED'
  | 'MEETING_PRESENTATION_UPDATED'
  | 'MEETING_DECISION_CREATED'
  | 'MEETING_ENDED'
  | 'TASK_CREATED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'TOKEN_USAGE_UPDATED'
  | 'WORKFORCE_COMPLETED';

export interface WorldEvent {
  event_id: string;
  sequence: number;
  workforce_id: string;
  event_type: WorldEventType;
  entity_id: string;
  payload: Record<string, unknown>;
  timestamp: string;
}
