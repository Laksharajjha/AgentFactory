import React from 'react';
import { Activity, Radio } from 'lucide-react';
import { useEventStore } from '../state/eventStore';
import { WorldEvent } from '../types/event';

function summarizeEvent(evt: WorldEvent): string {
  const p = evt.payload || {};
  switch (evt.event_type) {
    case 'AGENT_CREATED':
      return `${p.name || 'Agent'} stationed in ${p.room_id || 'office'}`;
    case 'AGENT_TASK_ASSIGNED':
      return `${p.agent_name} assigned '${p.task_title}'`;
    case 'AGENT_MOVEMENT_REQUESTED':
      return `${p.agent_name} walking to ${p.to_room_name || p.to_room_id}`;
    case 'AGENT_LOCATION_CHANGED':
      return `${p.agent_name} arrived in ${p.room_name || p.room_id}`;
    case 'AGENT_WORK_STARTED':
      return `${p.agent_name} started executing '${p.task_title}'`;
    case 'AGENT_WORK_COMPLETED':
      return `${p.agent_name} completed '${p.task_title}'`;
    case 'AGENT_MESSAGE_CREATED':
      return `${p.sender_name || p.sender_id}: ${String(p.content || '').slice(0, 85)}`;
    case 'MEETING_REQUESTED':
      return `${p.initiator_name} convened Boardroom Session: '${p.title}'`;
    case 'MEETING_PARTICIPANT_JOINED':
      return `${p.agent_name} took Seat #${Number(p.seat_index || 0) + 1} in Main Boardroom`;
    case 'MEETING_STARTED':
      return `Boardroom session '${p.title}' is now LIVE`;
    case 'MEETING_MESSAGE_CREATED':
      return `[Boardroom] ${p.sender_name}: ${String(p.content || '').slice(0, 80)}`;
    case 'MEETING_PRESENTATION_UPDATED':
      return `${p.presenter_name} presented '${p.title}' on Boardroom Wall`;
    case 'MEETING_DECISION_CREATED':
      return `Decision Ratified: ${p.title} (Owner: ${p.owner_name})`;
    case 'MEETING_ENDED':
      return `Boardroom session '${p.title}' concluded`;
    case 'TASK_CREATED':
      return `Task created: '${p.title}' (${p.assigned_agent_name || 'Team'})`;
    case 'TASK_COMPLETED':
      return `Deliverable verified: '${p.title}'`;
    case 'TOKEN_USAGE_UPDATED':
      return `LLM Call (${p.operation}): +${p.total_tokens} tokens`;
    case 'WORKFORCE_COMPLETED':
      return `Workforce mission '${p.workforce_name}' completed all deliverables`;
    default:
      return `${evt.event_type} (${evt.entity_id})`;
  }
}

interface ActivityFeedProps {
  compact?: boolean;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ compact = false }) => {
  const events = useEventStore((s) => s.events);
  const wsConnected = useEventStore((s) => s.wsConnected);

  const reversed = [...events].reverse();

  if (compact) {
    const latest = reversed[0];
    return (
      <div className="flex items-center gap-2 text-xs truncate">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
          }`}
        />
        <span className="font-mono text-[10px] text-amber-400 shrink-0">
          {latest ? `#${latest.sequence}` : 'LIVE'}
        </span>
        <span className="text-slate-300 truncate">
          {latest
            ? summarizeEvent(latest)
            : 'World Engine connected. Ready for autonomous execution.'}
        </span>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-white flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-amber-400" />
          Sequenced Event Log ({events.length})
        </div>
        <span className="text-[10px] font-mono flex items-center gap-1 text-emerald-400">
          <Radio className="w-3 h-3" /> {wsConnected ? 'WS STREAM LIVE' : 'RECONNECTING'}
        </span>
      </div>

      <div className="space-y-1.5">
        {reversed.map((evt) => (
          <div
            key={evt.event_id}
            className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/90 space-y-1 text-[11px]"
          >
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-amber-300">{evt.event_type}</span>
              <span className="text-slate-500">
                seq #{evt.sequence} • {new Date(evt.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="text-slate-200 leading-snug">{summarizeEvent(evt)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
