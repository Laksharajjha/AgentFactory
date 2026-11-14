import React from 'react';
import { ArrowLeft, Building2, Cpu, Eye, Maximize2, Monitor, Users } from 'lucide-react';
import { CharacterInspector } from '../../characters/CharacterInspector';
import { useAgentState } from '../../hooks/useAgentState';
import { useMeeting } from '../../hooks/useMeeting';
import { MeetingPanel } from '../../meetings/MeetingPanel';
import { TokenUsagePanel } from '../../monitoring/TokenUsagePanel';
import { WorkforceMetrics } from '../../monitoring/WorkforceMetrics';
import { useWorldStore } from '../../state/worldStore';

export const RightInspector: React.FC = () => {
  const { selectedAgent } = useAgentState();
  const { splitViewOpen, setSplitViewOpen } = useMeeting();
  const selectedRoomId = useWorldStore((s) => s.selectedRoomId);
  const rooms = useWorldStore((s) => s.rooms);
  const agents = useWorldStore((s) => s.agents);
  const focusCharacter = useWorldStore((s) => s.focusCharacter);
  const focusBuilding = useWorldStore((s) => s.focusBuilding);
  const focusRoom = useWorldStore((s) => s.focusRoom);
  const enterInteriorView = useWorldStore((s) => s.enterInteriorView);
  const roomInspectionMode = useWorldStore((s) => s.roomInspectionMode);
  const setExpandedScreenRoomId = useWorldStore((s) => s.setExpandedScreenRoomId);

  // If the user is observing a live or selected Boardroom session in split-view, show MeetingPanel
  if (splitViewOpen) {
    return (
      <aside className="w-[410px] bg-[#0d1119]/95 backdrop-blur-md border-l border-slate-800/90 h-full overflow-hidden z-20 shrink-0">
        <MeetingPanel />
      </aside>
    );
  }

  // If an employee character is selected, show CharacterInspector
  if (selectedAgent) {
    return (
      <aside className="w-96 bg-[#0d1119]/95 backdrop-blur-md border-l border-slate-800/90 h-full overflow-hidden z-20 shrink-0">
        <CharacterInspector agent={selectedAgent} />
      </aside>
    );
  }

  // If a room is selected, show Room Inspector
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  if (selectedRoom) {
    if (selectedRoom.id === 'boardroom') {
      return (
        <aside className="w-[410px] bg-[#0d1119]/95 backdrop-blur-md border-l border-slate-800/90 h-full overflow-hidden z-20 shrink-0">
          <MeetingPanel />
        </aside>
      );
    }

    const occupants = agents.filter((a) => a.current_room_id === selectedRoom.id);

    return (
      <aside className="w-96 bg-[#0d1119]/95 backdrop-blur-md border-l border-slate-800/90 h-full overflow-y-auto p-4 space-y-4 z-20 shrink-0 text-slate-200">
        <div className="flex items-center justify-between">
          <button
            onClick={focusBuilding}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Building</span>
          </button>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-sky-300">
            Floor {selectedRoom.floor} Isolated
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">{selectedRoom.name}</h3>
            <Building2 className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{selectedRoom.description}</p>

          {/* Camera Inspection Angle Switcher */}
          <div className="pt-2 flex items-center gap-1.5">
            <button
              onClick={() => focusRoom(selectedRoom.id, 'ARCHITECTURAL')}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
                roomInspectionMode === 'ARCHITECTURAL'
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Architectural Cutaway
            </button>
            <button
              onClick={() => enterInteriorView(selectedRoom.id)}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
                roomInspectionMode === 'INTERIOR'
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Interior Close-Up
            </button>
          </div>
        </div>

        {/* Interactive Workstation Screen CTA */}
        <button
          onClick={() => setExpandedScreenRoomId(selectedRoom.id)}
          className="w-full p-3 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-left flex items-center justify-between transition"
        >
          <div className="flex items-center gap-2.5">
            <Monitor className="w-4 h-4 text-sky-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-white">Open Workstation Monitor</div>
              <div className="text-[10px] text-sky-300">
                Inspect live {selectedRoom.name} screen in full resolution
              </div>
            </div>
          </div>
          <Maximize2 className="w-4 h-4 text-sky-300 shrink-0" />
        </button>

        {/* Room Displays */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5 text-sky-400" /> Active Room Screens
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {selectedRoom.displays.map((disp) => (
              <div
                key={disp}
                onClick={() => setExpandedScreenRoomId(selectedRoom.id)}
                className="p-2.5 rounded-lg bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-sky-500/50 cursor-pointer text-xs text-slate-200 flex items-center justify-between transition"
              >
                <span>{disp}</span>
                <span className="text-[10px] font-mono text-emerald-400">CLICK TO EXPAND</span>
              </div>
            ))}
          </div>
        </div>

        {/* Occupants */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-400" /> Current Occupants ({occupants.length})
          </div>
          {occupants.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/70 text-xs text-slate-500 text-center">
              No employees currently stationed in {selectedRoom.name}.
            </div>
          ) : (
            occupants.map((occ) => (
              <div
                key={occ.id}
                onClick={() => focusCharacter(occ.id)}
                className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-white">{occ.name}</div>
                  <div className="text-[10px] text-slate-400">{occ.role}</div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                  {occ.state}
                </span>
              </div>
            ))
          )}
        </div>

        {selectedRoom.id === 'ceo_office' && (
          <div className="pt-2 border-t border-slate-800">
            <WorkforceMetrics />
          </div>
        )}
      </aside>
    );
  }

  // Default Inspector: Token Economics & Quick Boardroom Observer
  return (
    <aside className="w-96 bg-[#0d1119]/95 backdrop-blur-md border-l border-slate-800/90 h-full overflow-y-auto z-20 shrink-0">
      <div className="p-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40">
        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-amber-400" /> Inspector & Telemetry
        </span>
        <button
          onClick={() => {
            focusRoom('boardroom', 'ARCHITECTURAL');
            setSplitViewOpen(true);
          }}
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-sky-300 flex items-center gap-1"
        >
          <Eye className="w-3 h-3" /> Boardroom View
        </button>
      </div>
      <TokenUsagePanel />
    </aside>
  );
};
