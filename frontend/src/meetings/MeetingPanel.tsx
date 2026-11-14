import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ListChecks,
  PauseCircle,
  PlayCircle,
  Presentation,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import { useMeeting } from '../hooks/useMeeting';
import { useWorldStore } from '../state/worldStore';
import { MeetingTranscript } from './MeetingTranscript';
import { ParticipantList } from './ParticipantList';
import { PresentationViewer } from './PresentationViewer';

export const MeetingPanel: React.FC = () => {
  const {
    meetings,
    currentMeeting,
    observationPaused,
    setObservationPaused,
    setExpandedPresentation,
    setSplitViewOpen,
    setSelectedMeetingId,
    triggerBoardroomMeeting,
  } = useMeeting();
  const focusRoom = useWorldStore((s) => s.focusRoom);
  const focusBuilding = useWorldStore((s) => s.focusBuilding);
  const [transcriptExpanded, setTranscriptExpanded] = useState(true);

  if (!currentMeeting) {
    return (
      <div className="p-6 text-center space-y-3">
        <div className="flex justify-start mb-2">
          <button
            onClick={() => {
              setSplitViewOpen(false);
              focusBuilding();
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Building</span>
          </button>
        </div>
        <Video className="w-8 h-8 text-amber-400 mx-auto opacity-80" />
        <div className="text-sm font-bold text-white">No Boardroom Session Active</div>
        <p className="text-xs text-slate-400 leading-relaxed">
          When an agent detects architectural or security trade-offs requiring cross-functional collaboration,
          Alex convenes a live session in the Main Boardroom.
        </p>
        <button
          onClick={() => void triggerBoardroomMeeting()}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 transition"
        >
          <Sparkles className="w-3.5 h-3.5" /> Convene Executive Boardroom Session Now
        </button>
      </div>
    );
  }

  const latestPresentation =
    currentMeeting.presentations.length > 0
      ? currentMeeting.presentations[currentMeeting.presentations.length - 1]
      : null;

  return (
    <div className="flex flex-col h-full bg-[#0e131d]/95 text-slate-100">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800/90 bg-slate-900/60 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-[10px] font-bold">
              {currentMeeting.status}
            </span>
            <button
              onClick={() => focusRoom('boardroom', 'ARCHITECTURAL')}
              className="text-[11px] text-amber-300 hover:underline font-medium"
            >
              Focus 3D Boardroom
            </button>
            <button
              onClick={() => {
                setSplitViewOpen(false);
                focusBuilding();
              }}
              className="text-[11px] text-slate-400 hover:text-white font-medium"
            >
              • Return to Building
            </button>
          </div>
          <h3 className="text-sm font-bold text-white mt-1">{currentMeeting.title}</h3>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setObservationPaused(!observationPaused)}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1"
            title="Pause/Resume Transcript Auto-Scroll"
          >
            {observationPaused ? (
              <>
                <PlayCircle className="w-3.5 h-3.5 text-amber-400" /> Resume
              </>
            ) : (
              <>
                <PauseCircle className="w-3.5 h-3.5 text-sky-400" /> Pause
              </>
            )}
          </button>
          <button
            onClick={() => setSplitViewOpen(false)}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white"
            title="Close Split View"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Meeting History Selector if multiple meetings exist */}
      {meetings.length > 1 && (
        <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-950/50 flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] text-slate-400 uppercase font-semibold shrink-0">Sessions:</span>
          {meetings.map((m, idx) => (
            <button
              key={m.id}
              onClick={() => setSelectedMeetingId(m.id)}
              className={`px-2 py-0.5 rounded text-[11px] truncate max-w-[160px] ${
                m.id === currentMeeting.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              #{meetings.length - idx} {m.title}
            </button>
          ))}
        </div>
      )}

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Participants */}
        <ParticipantList
          participants={currentMeeting.participants}
          activeSpeakerId={currentMeeting.active_speaker_id}
        />

        {/* Agenda */}
        {currentMeeting.agenda.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800/90 rounded-xl p-3 space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ListChecks className="w-3.5 h-3.5 text-amber-400" /> Boardroom Agenda
            </div>
            <ul className="space-y-1 text-xs text-slate-300">
              {currentMeeting.agenda.map((item, i) => (
                <li key={i} className="leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Active Presentation Slide */}
        {latestPresentation && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <Presentation className="w-3.5 h-3.5" /> Physical Boardroom Screen Feed (
                {currentMeeting.presentations.length} slides)
              </span>
            </div>
            <PresentationViewer
              presentation={latestPresentation}
              onExpand={() => setExpandedPresentation(latestPresentation)}
            />
            {currentMeeting.presentations.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {currentMeeting.presentations.map((p, idx) => (
                  <button
                    key={p.id}
                    onClick={() => setExpandedPresentation(p)}
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[10px] text-slate-300 shrink-0"
                  >
                    Slide {idx + 1}: {p.presentation_type.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collapsible / Expandable Live Transcript */}
        <div className="space-y-1.5">
          <button
            onClick={() => setTranscriptExpanded(!transcriptExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 transition"
          >
            <span>Live Discussion Transcript ({currentMeeting.messages.length} turns)</span>
            <span className="flex items-center gap-1 text-[10px] text-sky-400">
              {transcriptExpanded ? (
                <>
                  <span>Hide</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>Expand</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </span>
          </button>
          {transcriptExpanded && (
            <MeetingTranscript
              messages={currentMeeting.messages}
              observationPaused={observationPaused}
            />
          )}
        </div>

        {/* Ratified Decisions & Action Items */}
        {currentMeeting.decisions.length > 0 && (
          <div className="space-y-2.5">
            <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5" /> Ratified Decisions & Action Items (
              {currentMeeting.decisions.length})
            </div>
            {currentMeeting.decisions.map((dec) => (
              <div
                key={dec.id}
                className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-700/40 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white">{dec.title}</span>
                  {dec.owner_name && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                      Owner: {dec.owner_name}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">{dec.rationale}</p>
                {dec.action_items.length > 0 && (
                  <div className="pt-1 border-t border-emerald-800/40 space-y-1">
                    <div className="text-[10px] font-semibold text-emerald-300 uppercase">
                      Assigned Action Items:
                    </div>
                    <ul className="list-disc list-inside text-[11px] text-slate-200 space-y-0.5">
                      {dec.action_items.map((ai, idx) => (
                        <li key={idx}>{ai}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
