import React from 'react';
import {
  Activity,
  Building,
  CheckSquare,
  Compass,
  Factory,
  Layers,
  Users,
  Video,
} from 'lucide-react';
import { FactoryPanel } from '../../factory/FactoryPanel';
import { useMeeting } from '../../hooks/useMeeting';
import { ActivityFeed } from '../../monitoring/ActivityFeed';
import { WorkforceMetrics } from '../../monitoring/WorkforceMetrics';
import { LeftSidebarTab, useWorldStore } from '../../state/worldStore';
import { TaskPanel } from '../../tasks/TaskPanel';

export const LeftSidebar: React.FC = () => {
  const activeLeftTab = useWorldStore((s) => s.activeLeftTab);
  const setActiveLeftTab = useWorldStore((s) => s.setActiveLeftTab);
  const rooms = useWorldStore((s) => s.rooms);
  const agents = useWorldStore((s) => s.agents);
  const selectedRoomId = useWorldStore((s) => s.selectedRoomId);
  const selectedAgentId = useWorldStore((s) => s.selectedAgentId);
  const isolatedFloor = useWorldStore((s) => s.isolatedFloor);
  const selectRoom = useWorldStore((s) => s.selectRoom);
  const selectAgent = useWorldStore((s) => s.selectAgent);
  const setIsolatedFloor = useWorldStore((s) => s.setIsolatedFloor);

  const { meetings, setSplitViewOpen, setSelectedMeetingId, triggerBoardroomMeeting } =
    useMeeting();

  const navItems: Array<{ id: LeftSidebarTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'CEO Overview', icon: <Compass className="w-4 h-4" /> },
    { id: 'floors', label: 'Floors & Rooms', icon: <Layers className="w-4 h-4" /> },
    { id: 'agents', label: 'Employees', icon: <Users className="w-4 h-4" /> },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="w-4 h-4" /> },
    { id: 'meetings', label: 'Meetings', icon: <Video className="w-4 h-4" /> },
    { id: 'factory', label: 'Factory', icon: <Factory className="w-4 h-4" /> },
    { id: 'history', label: 'Event Log', icon: <Activity className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-80 bg-[#0d1119]/95 backdrop-blur-md border-r border-slate-800/90 flex h-full select-none z-20 shrink-0">
      {/* Compact Vertical Icon Rail */}
      <div className="w-14 bg-[#090c12] border-r border-slate-800/80 flex flex-col items-center py-3 gap-2 shrink-0">
        {navItems.map((item) => {
          const active = activeLeftTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveLeftTab(item.id)}
              title={item.label}
              className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition ${
                active
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-inner'
                  : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
              }`}
            >
              {item.icon}
              <span className="text-[8px] font-medium tracking-tight">
                {item.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Drawer Content */}
      <div className="flex-1 overflow-y-auto">
        {activeLeftTab === 'overview' && <WorkforceMetrics />}

        {activeLeftTab === 'floors' && (
          <div className="p-3 space-y-4">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Building className="w-4 h-4 text-amber-400" /> Architectural Floor Directory
            </div>

            {[0, 1, 2].map((fl) => {
              const floorRooms = rooms.filter((r) => r.floor === fl);
              const floorNames = [
                'Ground Floor (Executive & Boardroom)',
                'First Floor (Architecture & Engineering)',
                'Second Floor (QA, Security & Operations)',
              ];
              return (
                <div key={fl} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-300">
                      {floorNames[fl]}
                    </span>
                    <button
                      onClick={() => setIsolatedFloor(isolatedFloor === fl ? null : fl)}
                      className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                        isolatedFloor === fl
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {isolatedFloor === fl ? 'Showing Only F' + fl : 'Isolate F' + fl}
                    </button>
                  </div>

                  <div className="space-y-1">
                    {floorRooms.map((room) => {
                      const occ = agents.filter((a) => a.current_room_id === room.id);
                      const isSel = selectedRoomId === room.id;
                      return (
                        <div
                          key={room.id}
                          onClick={() => selectRoom(room.id, true)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition ${
                            isSel
                              ? 'bg-slate-900 border-amber-400/80'
                              : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-white">{room.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {occ.length} {occ.length === 1 ? 'agent' : 'agents'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                            {room.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeLeftTab === 'agents' && (
          <div className="p-3 space-y-2.5">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-400" /> AI Workforce Directory ({agents.length})
            </div>

            {agents.map((ag) => {
              const isSel = selectedAgentId === ag.id;
              const accent = ag.avatar_config?.accent_color || '#3b82f6';
              return (
                <div
                  key={ag.id}
                  onClick={() => selectAgent(ag.id, true)}
                  className={`p-3 rounded-xl border cursor-pointer transition space-y-1.5 ${
                    isSel
                      ? 'bg-slate-900 border-amber-400'
                      : 'bg-slate-900/60 border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ backgroundColor: accent }}
                      >
                        {ag.avatar_config?.badge || ag.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <div className="text-xs font-bold text-white">{ag.name}</div>
                        <div className="text-[10px] text-slate-400">{ag.role}</div>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                      {ag.state}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 truncate">
                    {ag.current_activity}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeLeftTab === 'tasks' && <TaskPanel />}

        {activeLeftTab === 'meetings' && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Video className="w-4 h-4 text-amber-400" /> Boardroom Sessions ({meetings.length})
              </span>
              <button
                onClick={() => void triggerBoardroomMeeting()}
                className="px-2 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[10px]"
              >
                Convene Now
              </button>
            </div>

            {meetings.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-400 text-center">
                No boardroom meetings recorded yet.
              </div>
            ) : (
              meetings.map((m) => (
                <div
                  key={m.id}
                  onClick={() => {
                    setSelectedMeetingId(m.id);
                    setSplitViewOpen(true);
                    selectRoom('boardroom', true);
                  }}
                  className="p-3 rounded-xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800 cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{m.title}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                      {m.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {m.participants.length} participants • {m.messages.length} turns •{' '}
                    {m.presentations.length} slides • {m.decisions.length} decisions
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeLeftTab === 'factory' && <FactoryPanel />}

        {activeLeftTab === 'history' && <ActivityFeed />}
      </div>
    </aside>
  );
};
