import React, { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { MeetingMessage } from '../types/meeting';

interface MeetingTranscriptProps {
  messages: MeetingMessage[];
  observationPaused: boolean;
}

const MESSAGE_TAG_COLORS: Record<string, string> = {
  EVIDENCE: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  CHALLENGE: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  QUESTION: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  PROPOSAL: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  DECISION: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  DISCUSSION: 'bg-slate-700/40 text-slate-300 border-slate-600',
};

export const MeetingTranscript: React.FC<MeetingTranscriptProps> = ({
  messages,
  observationPaused,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!observationPaused && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, observationPaused]);

  if (messages.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/70">
        Participants are gathering around the Main Boardroom table. Transcript will stream live...
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
        Live Multi-Agent Discussion Transcript ({messages.length} turns)
      </div>

      <div className="space-y-2">
        {messages.map((msg) => {
          const badgeClass =
            MESSAGE_TAG_COLORS[msg.message_type] || MESSAGE_TAG_COLORS.DISCUSSION;
          return (
            <div
              key={msg.id}
              className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/90 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{msg.sender_name}</span>
                  <span className="text-[10px] text-slate-400">{msg.sender_role}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${badgeClass}`}>
                    {msg.message_type}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">R{msg.round_number}</span>
                </div>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">{msg.content}</p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
