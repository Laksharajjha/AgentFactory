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
  const rightInspectorCollapsed = useWorldStore((s) => s.rightInspectorCollapsed);
  const activeAppSection = useWorldStore((s) => s.activeAppSection);

  // When viewing full-screen platform sections or when right inspector is collapsed (unless actively inspecting a room/agent/meeting)
  if (
    activeAppSection !== 'office' ||
    (rightInspectorCollapsed && !splitViewOpen && !selectedAgent && !selectedRoomId)
  ) {
    return null;
  }

  // If the user is observing a live or selected Boardroom session in split-view, show MeetingPanel
  if (splitViewOpen) {
    return (
      <aside className="w-[400px] bg-[#151920] border-l border-[#343A45]/80 h-full overflow-hidden z-20 shrink-0">
        <MeetingPanel />
      </aside>
    );
  }

  // If an employee character is selected, show CharacterInspector
  if (selectedAgent) {
    return (
      <aside className="w-96 bg-[#151920] border-l border-[#343A45]/80 h-full overflow-hidden z-20 shrink-0">
        <CharacterInspector agent={selectedAgent} />
      </aside>
    );
  }

  // If a room is selected, show Room Inspector
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  if (selectedRoom) {
    if (selectedRoom.id === 'boardroom') {
      return (
        <aside className="w-[400px] bg-[#151920] border-l border-[#343A45]/80 h-full overflow-hidden z-20 shrink-0">
          <MeetingPanel />
        </aside>
      );
    }

    const occupants = agents.filter((a) => a.current_room_id === selectedRoom.id);

    return (
      <aside className="w-96 bg-[#151920] border-l border-[#343A45]/80 h-full overflow-y-auto p-4 space-y-4 z-20 shrink-0 text-[#E8EBF0]">
        <div className="flex items-center justify-between">
          <button
            onClick={focusBuilding}
            className="px-2.5 py-1 rounded-md bg-[#1B2028] hover:bg-[#22262E] border border-[#343A45] text-xs font-semibold text-[#E8EBF0] flex items-center gap-1.5 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#4778D0]" />
            <span>Return to Building</span>
          </button>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#101216] border border-[#343A45] text-[#4778D0]">
            Floor {selectedRoom.floor} Isolated
          </span>
        </div>

        <div className="p-3.5 rounded-md bg-[#101216] border border-[#343A45] space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#E8EBF0]">{selectedRoom.name}</h3>
            <Building2 className="w-4 h-4 text-[#4778D0]" />
          </div>
          <p className="text-xs text-[#A5ACB8] leading-relaxed">{selectedRoom.description}</p>

          {/* Camera Inspection Angle Switcher */}
          <div className="pt-2 flex items-center gap-1.5">
            <button
              onClick={() => focusRoom(selectedRoom.id, 'ARCHITECTURAL')}
              className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold border transition ${
                roomInspectionMode === 'ARCHITECTURAL'
                  ? 'bg-[#4778D0]/20 border-[#4778D0] text-[#4778D0]'
                  : 'bg-[#151920] border-[#343A45] text-[#A5ACB8] hover:text-[#E8EBF0]'
              }`}
            >
              Architectural Cutaway
            </button>
            <button
              onClick={() => enterInteriorView(selectedRoom.id)}
              className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold border transition ${
                roomInspectionMode === 'INTERIOR'
                  ? 'bg-[#4778D0]/20 border-[#4778D0] text-[#4778D0]'
                  : 'bg-[#151920] border-[#343A45] text-[#A5ACB8] hover:text-[#E8EBF0]'
              }`}
            >
              Interior Close-Up
            </button>
          </div>
        </div>

        {/* Interactive Workstation Screen CTA */}
        <button
          onClick={() => setExpandedScreenRoomId(selectedRoom.id)}
          className="w-full p-3 rounded-md bg-[#4778D0]/15 hover:bg-[#4778D0]/25 border border-[#4778D0]/40 text-left flex items-center justify-between transition"
        >
          <div className="flex items-center gap-2.5">
            <Monitor className="w-4 h-4 text-[#4778D0] shrink-0" />
            <div>
              <div className="text-xs font-semibold text-[#E8EBF0]">Open Workstation Monitor</div>
              <div className="text-[10px] text-[#A5ACB8]">
                Inspect live {selectedRoom.name} screen in full resolution
              </div>
            </div>
          </div>
          <Maximize2 className="w-4 h-4 text-[#4778D0] shrink-0" />
        </button>

        {/* Room Displays */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-[#A5ACB8] uppercase tracking-wider flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5 text-[#4778D0]" /> Active Room Screens
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {selectedRoom.displays.map((disp) => (
              <div
                key={disp}
                onClick={() => setExpandedScreenRoomId(selectedRoom.id)}
                className="p-2.5 rounded-md bg-[#101216] hover:bg-[#1B2028] border border-[#343A45] hover:border-[#4778D0]/50 cursor-pointer text-xs text-[#E8EBF0] flex items-center justify-between transition"
              >
                <span>{disp}</span>
                <span className="text-[10px] font-mono text-[#299B83]">EXPAND</span>
              </div>
            ))}
          </div>
        </div>

        {/* Occupants */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-[#A5ACB8] uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#4778D0]" /> Current Occupants ({occupants.length})
          </div>
          {occupants.length === 0 ? (
            <div className="p-4 rounded-md bg-[#101216] border border-[#343A45] text-xs text-[#737D8C] text-center">
              No employees currently stationed in {selectedRoom.name}.
            </div>
          ) : (
            occupants.map((occ) => (
              <div
                key={occ.id}
                onClick={() => focusCharacter(occ.id)}
                className="p-2.5 rounded-md bg-[#101216] hover:bg-[#1B2028] border border-[#343A45] cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-semibold text-[#E8EBF0]">{occ.name}</div>
                  <div className="text-[10px] text-[#A5ACB8]">{occ.role}</div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1B2028] text-[#4778D0]">
                  {occ.state}
                </span>
              </div>
            ))
          )}
        </div>

        {selectedRoom.id === 'ceo_office' && (
          <div className="pt-2 border-t border-[#343A45]">
            <WorkforceMetrics />
          </div>
        )}
      </aside>
    );
  }

  // Default Inspector: Token Economics & Quick Boardroom Observer
  return (
    <aside className="w-80 bg-[#151920] border-l border-[#343A45]/80 h-full overflow-y-auto z-20 shrink-0">
      <div className="p-2.5 border-b border-[#343A45] flex items-center justify-between bg-[#101216]">
        <span className="text-xs font-semibold text-[#E8EBF0] flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-[#4778D0]" /> Inspector & Telemetry
        </span>
        <button
          onClick={() => {
            focusRoom('boardroom', 'ARCHITECTURAL');
            setSplitViewOpen(true);
          }}
          className="px-2 py-1 rounded-md bg-[#1B2028] hover:bg-[#22262E] border border-[#343A45] text-[10px] text-[#E8EBF0] flex items-center gap-1"
        >
          <Eye className="w-3 h-3 text-[#4778D0]" /> Boardroom
        </button>
      </div>
      <TokenUsagePanel />
    </aside>
  );
};
