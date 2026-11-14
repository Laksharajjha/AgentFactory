import React, { useEffect, useState } from 'react';
import { Clock, Pause, Play, Video } from 'lucide-react';
import { useMeeting } from '../../hooks/useMeeting';
import { ActivityFeed } from '../../monitoring/ActivityFeed';
import { useWorldStore } from '../../state/worldStore';

export const BottomControlBar: React.FC = () => {
  const simulationSpeed = useWorldStore((s) => s.simulationSpeed);
  const isPaused = useWorldStore((s) => s.isPaused);
  const setSimulationControl = useWorldStore((s) => s.setSimulationControl);

  const { isMeetingLive, activeMeeting, setSplitViewOpen } = useMeeting();

  const [simSeconds, setSimSeconds] = useState(0);

  useEffect(() => {
    if (isPaused) return;
    const interval = window.setInterval(() => {
      setSimSeconds((s) => s + 1);
    }, Math.max(200, Math.round(1000 / simulationSpeed)));
    return () => clearInterval(interval);
  }, [isPaused, simulationSpeed]);

  const formatSimTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600) + 9; // Start at 09:00 AM office time
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs % 24).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(
      secs
    ).padStart(2, '0')}`;
  };

  return (
    <footer className="h-11 px-4 bg-[#0d1119]/95 backdrop-blur-md border-t border-slate-800/90 flex items-center justify-between gap-4 select-none z-30 shrink-0">
      {/* Left: Simulation Clock & Play/Pause + Speed Controls (1x, 2x, 5x) */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>SIM {formatSimTime(simSeconds)}</span>
        </div>

        <button
          onClick={() => void setSimulationControl(simulationSpeed, !isPaused)}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border transition ${
            isPaused
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-slate-900 text-slate-200 border-slate-800 hover:bg-slate-800'
          }`}
        >
          {isPaused ? (
            <>
              <Play className="w-3.5 h-3.5" /> Play
            </>
          ) : (
            <>
              <Pause className="w-3.5 h-3.5" /> Pause
            </>
          )}
        </button>

        <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
          {[1, 2, 5].map((spd) => (
            <button
              key={spd}
              onClick={() => void setSimulationControl(spd, isPaused)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition ${
                simulationSpeed === spd
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Center: Live Compact Activity Feed */}
      <div className="flex-1 min-w-0 max-w-2xl">
        <ActivityFeed compact />
      </div>

      {/* Right: Active Meeting Indicator */}
      <div className="shrink-0 flex items-center gap-2">
        {isMeetingLive && activeMeeting ? (
          <button
            onClick={() => setSplitViewOpen(true)}
            className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 animate-pulse"
          >
            <Video className="w-3.5 h-3.5" />
            <span>LIVE: {activeMeeting.title.slice(0, 32)}...</span>
          </button>
        ) : (
          <span className="text-[11px] text-slate-500 font-mono">
            BOARDROOM: STANDBY
          </span>
        )}
      </div>
    </footer>
  );
};
