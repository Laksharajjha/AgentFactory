import React from 'react';
import { Eye, Sparkles, Video } from 'lucide-react';
import { useMeeting } from '../hooks/useMeeting';
import { useWorldStore } from '../state/worldStore';

export const MeetingRoom: React.FC = () => {
  const { currentMeeting, isMeetingLive, splitViewOpen, setSplitViewOpen, triggerBoardroomMeeting } =
    useMeeting();
  const selectRoom = useWorldStore((s) => s.selectRoom);

  if (!currentMeeting && !isMeetingLive) {
    return null;
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2 rounded-full bg-slate-950/90 backdrop-blur-md border border-amber-500/40 shadow-2xl">
      <div className="flex items-center gap-2">
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            isMeetingLive ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
          }`}
        />
        <Video className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-semibold text-white">
          {currentMeeting?.title || 'Boardroom Session'}
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300">
          {currentMeeting?.status}
        </span>
      </div>

      <button
        onClick={() => {
          selectRoom('boardroom', true);
          setSplitViewOpen(!splitViewOpen);
        }}
        className="px-3 py-1 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1 transition"
      >
        <Eye className="w-3.5 h-3.5" />
        {splitViewOpen ? 'Hide Split View' : 'Observe Boardroom'}
      </button>

      {!isMeetingLive && (
        <button
          onClick={() => void triggerBoardroomMeeting()}
          className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs flex items-center gap-1 transition"
        >
          <Sparkles className="w-3 h-3" /> Re-Convene
        </button>
      )}
    </div>
  );
};
