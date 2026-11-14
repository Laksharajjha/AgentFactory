import React from 'react';
import { Mic, Users } from 'lucide-react';
import { useWorldStore } from '../state/worldStore';
import { MeetingParticipant } from '../types/meeting';

interface ParticipantListProps {
  participants: MeetingParticipant[];
  activeSpeakerId?: string | null;
}

export const ParticipantList: React.FC<ParticipantListProps> = ({
  participants,
  activeSpeakerId,
}) => {
  const selectAgent = useWorldStore((s) => s.selectAgent);

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5 text-amber-400" />
        Seated Boardroom Participants ({participants.length})
      </div>
      <div className="flex flex-wrap gap-1.5">
        {participants.map((p) => {
          const isSpeaking = p.agent_id === activeSpeakerId;
          return (
            <button
              key={p.agent_id}
              onClick={() => selectAgent(p.agent_id, true)}
              className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 border transition ${
                isSpeaking
                  ? 'bg-sky-500/20 border-sky-400 text-white shadow-sm'
                  : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              {isSpeaking ? (
                <Mic className="w-3 h-3 text-sky-400 animate-pulse" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
              <span className="font-semibold">{p.agent_name}</span>
              <span className="text-[10px] text-slate-400">({p.agent_role.split(' ')[0]})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
