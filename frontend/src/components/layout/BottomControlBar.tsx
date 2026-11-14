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
    <footer className="h-9 px-3 bg-[#101216] border-t border-[#343A45]/80 flex items-center justify-between gap-4 select-none z-30 shrink-0 text-[#E8EBF0]">
      {/* Left: Simulation Clock & Play/Pause + Speed Controls (1x, 2x, 5x) */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#A5ACB8] bg-[#151920] px-2 py-0.5 rounded-md border border-[#343A45]">
          <Clock className="w-3 h-3 text-[#4778D0]" />
          <span>SIM {formatSimTime(simSeconds)}</span>
        </div>

        <button
          onClick={() => void setSimulationControl(simulationSpeed, !isPaused)}
          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1 border transition ${
            isPaused
              ? 'bg-[#D29A43] text-[#101216] border-[#D29A43]'
              : 'bg-[#151920] text-[#E8EBF0] border-[#343A45] hover:bg-[#1B2028]'
          }`}
        >
          {isPaused ? (
            <>
              <Play className="w-3 h-3" /> Play
            </>
          ) : (
            <>
              <Pause className="w-3 h-3" /> Pause
            </>
          )}
        </button>

        <div className="flex items-center bg-[#151920] p-0.5 rounded-md border border-[#343A45]">
          {[1, 2, 5].map((spd) => (
            <button
              key={spd}
              onClick={() => void setSimulationControl(spd, isPaused)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                simulationSpeed === spd
                  ? 'bg-[#4778D0] text-white'
                  : 'text-[#737D8C] hover:text-[#E8EBF0]'
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
            className="px-2.5 py-0.5 rounded-md bg-[#299B83]/20 border border-[#299B83]/50 text-[#299B83] text-[11px] font-semibold flex items-center gap-1.5 animate-pulse"
          >
            <Video className="w-3 h-3" />
            <span>LIVE: {activeMeeting.title.slice(0, 32)}...</span>
          </button>
        ) : (
          <span className="text-[10px] text-[#737D8C] font-mono">
            BOARDROOM: STANDBY
          </span>
        )}
      </div>
    </footer>
  );
};
