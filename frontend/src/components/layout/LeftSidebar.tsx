import React from 'react';
import {
  Activity,
  Briefcase,
  Building,
  Building2,
  CheckSquare,
  Compass,
  Cpu,
  Factory,
  FileCode2,
  FolderGit2,
  GitBranch,
  History,
  Layers,
  Plug,
  Settings,
  Users,
  Video,
} from 'lucide-react';
import { FactoryPanel } from '../../factory/FactoryPanel';
import { useMeeting } from '../../hooks/useMeeting';
import { ActivityFeed } from '../../monitoring/ActivityFeed';
import { WorkforceMetrics } from '../../monitoring/WorkforceMetrics';
import { AppSection, LeftSidebarTab, useWorldStore } from '../../state/worldStore';
import { TaskPanel } from '../../tasks/TaskPanel';

export const LeftSidebar: React.FC = () => {
  const activeAppSection = useWorldStore((s) => s.activeAppSection);
  const setActiveAppSection = useWorldStore((s) => s.setActiveAppSection);
  const activeLeftTab = useWorldStore((s) => s.activeLeftTab);
  const setActiveLeftTab = useWorldStore((s) => s.setActiveLeftTab);
  const leftNavCollapsed = useWorldStore((s) => s.leftNavCollapsed);
  const setLeftNavCollapsed = useWorldStore((s) => s.setLeftNavCollapsed);
  const setSettingsModalOpen = useWorldStore((s) => s.setSettingsModalOpen);

  const rooms = useWorldStore((s) => s.rooms);
  const agents = useWorldStore((s) => s.agents);
  const selectedRoomId = useWorldStore((s) => s.selectedRoomId);
  const selectedAgentId = useWorldStore((s) => s.selectedAgentId);
  const isolatedFloor = useWorldStore((s) => s.isolatedFloor);
  const selectRoom = useWorldStore((s) => s.selectRoom);
  const selectAgent = useWorldStore((s) => s.selectAgent);
  const setIsolatedFloor = useWorldStore((s) => s.setIsolatedFloor);
  const artifacts = useWorldStore((s) => s.artifacts);
  const executions = useWorldStore((s) => s.executions);
  const currentUser = useWorldStore((s) => s.currentUser);
  const isPlatformAdmin =
    currentUser?.platform_role === 'PLATFORM_ADMIN' ||
    currentUser?.platform_role === 'PLATFORM_OPERATOR';

  const { meetings, setSplitViewOpen, setSelectedMeetingId, triggerBoardroomMeeting } =
    useMeeting();

  const platformSections: Array<{
    id: AppSection;
    label: string;
    short: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    { id: 'office', label: '3D Office Campus', short: 'Office', icon: <Building2 className="w-4 h-4" /> },
    { id: 'projects', label: 'Projects & Factory', short: 'Projects', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'workspaces', label: 'Workspaces', short: 'Spaces', icon: <FolderGit2 className="w-4 h-4" /> },
    { id: 'github', label: 'GitHub & Sandboxes', short: 'GitHub', icon: <GitBranch className="w-4 h-4" /> },
    {
      id: 'artifacts',
      label: 'Deliverable Artifacts',
      short: 'Files',
      icon: <FileCode2 className="w-4 h-4" />,
      badge: artifacts.length,
    },
    {
      id: 'executions',
      label: 'Execution History',
      short: 'Runs',
      icon: <History className="w-4 h-4" />,
      badge: executions.length,
    },
    { id: 'integrations', label: 'Integrations', short: 'Connect', icon: <Plug className="w-4 h-4" /> },
    ...(isPlatformAdmin
      ? [{ id: 'admin' as AppSection, label: 'Resource Governor', short: 'Admin', icon: <Cpu className="w-4 h-4" /> }]
      : []),
  ];

  const officeSubTabs: Array<{ id: LeftSidebarTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <Compass className="w-3.5 h-3.5" /> },
    { id: 'floors', label: 'Rooms', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'agents', label: 'Staff', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="w-3.5 h-3.5" /> },
    { id: 'meetings', label: 'Board', icon: <Video className="w-3.5 h-3.5" /> },
    { id: 'factory', label: 'Brief', icon: <Factory className="w-3.5 h-3.5" /> },
    { id: 'history', label: 'Events', icon: <Activity className="w-3.5 h-3.5" /> },
  ];

  const showOfficeDrawer = activeAppSection === 'office' && !leftNavCollapsed;

  return (
    <aside
      className={`${
        showOfficeDrawer ? 'w-80' : 'w-14'
      } bg-[#151920] border-r border-[#343A45]/80 flex h-full select-none z-20 shrink-0 transition-all duration-150`}
    >
      {/* Primary Platform Navigation Rail */}
      <div className="w-14 bg-[#101216] border-r border-[#343A45]/80 flex flex-col items-center py-2.5 justify-between shrink-0">
        <div className="flex flex-col items-center gap-1.5 w-full px-1.5">
          {platformSections.map((item) => {
            const active = activeAppSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'office' && activeAppSection === 'office') {
                    setLeftNavCollapsed(!leftNavCollapsed);
                  } else {
                    setActiveAppSection(item.id);
                    if (item.id === 'office') {
                      setLeftNavCollapsed(false);
                    }
                  }
                }}
                title={item.label}
                className={`relative w-11 h-10 rounded-md flex flex-col items-center justify-center gap-0.5 transition ${
                  active
                    ? 'bg-[#4778D0]/20 text-[#4778D0] border border-[#4778D0]/50'
                    : 'text-[#A5ACB8] hover:bg-[#1B2028] hover:text-[#E8EBF0]'
                }`}
              >
                {item.icon}
                <span className="text-[8px] font-medium tracking-tight">{item.short}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 px-1 min-w-[13px] h-3.5 rounded-full bg-[#299B83] text-white font-mono text-[8px] font-bold flex items-center justify-center">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-1.5 w-full px-1.5">
          <button
            onClick={() => setSettingsModalOpen(true)}
            title="Platform & LLM Settings"
            className="w-11 h-9 rounded-md flex flex-col items-center justify-center text-[#A5ACB8] hover:bg-[#1B2028] hover:text-[#E8EBF0] transition"
          >
            <Settings className="w-4 h-4" />
            <span className="text-[8px] font-medium">Config</span>
          </button>
        </div>
      </div>

      {/* Collapsible Office Sub-Drawer */}
      {showOfficeDrawer && (
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Sub-navigation bar for 3D Office inspection */}
          <div className="p-1.5 bg-[#101216] border-b border-[#343A45]/80 grid grid-cols-4 gap-1 shrink-0">
            {officeSubTabs.map((sub) => {
              const active = activeLeftTab === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setActiveLeftTab(sub.id)}
                  className={`px-1.5 py-1 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition ${
                    active
                      ? 'bg-[#4778D0] text-white font-semibold'
                      : 'bg-[#151920] text-[#A5ACB8] hover:text-[#E8EBF0] hover:bg-[#1B2028]'
                  }`}
                >
                  {sub.icon}
                  <span>{sub.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeLeftTab === 'overview' && <WorkforceMetrics />}

            {activeLeftTab === 'floors' && (
              <div className="p-3 space-y-4">
                <div className="text-xs font-semibold text-[#E8EBF0] flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-[#4778D0]" /> Architectural Floor Directory
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
                        <span className="text-[11px] font-semibold text-[#A5ACB8]">
                          {floorNames[fl]}
                        </span>
                        <button
                          onClick={() => setIsolatedFloor(isolatedFloor === fl ? null : fl)}
                          className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                            isolatedFloor === fl
                              ? 'bg-[#4778D0] text-white font-semibold'
                              : 'bg-[#1B2028] text-[#A5ACB8] hover:bg-[#22262E]'
                          }`}
                        >
                          {isolatedFloor === fl ? 'Showing F' + fl : 'Isolate F' + fl}
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
                              className={`p-2.5 rounded-md border cursor-pointer transition ${
                                isSel
                                  ? 'bg-[#1B2028] border-[#4778D0]'
                                  : 'bg-[#101216]/70 border-[#343A45]/80 hover:border-[#4778D0]/50'
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-[#E8EBF0]">{room.name}</span>
                                <span className="text-[10px] font-mono text-[#737D8C]">
                                  {occ.length} {occ.length === 1 ? 'agent' : 'agents'}
                                </span>
                              </div>
                              <p className="text-[10px] text-[#A5ACB8] line-clamp-1 mt-0.5">
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
              <div className="p-3 space-y-2">
                <div className="text-xs font-semibold text-[#E8EBF0] flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#4778D0]" /> AI Workforce Directory ({agents.length})
                </div>

                {agents.map((ag) => {
                  const isSel = selectedAgentId === ag.id;
                  const accent = ag.avatar_config?.accent_color || '#4778D0';
                  return (
                    <div
                      key={ag.id}
                      onClick={() => selectAgent(ag.id, true)}
                      className={`p-2.5 rounded-md border cursor-pointer transition space-y-1.5 ${
                        isSel
                          ? 'bg-[#1B2028] border-[#4778D0]'
                          : 'bg-[#101216]/70 border-[#343A45]/80 hover:border-[#4778D0]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ backgroundColor: accent }}
                          >
                            {ag.avatar_config?.badge || ag.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <div className="text-xs font-semibold text-[#E8EBF0]">{ag.name}</div>
                            <div className="text-[10px] text-[#A5ACB8]">{ag.role}</div>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1B2028] text-[#4778D0] border border-[#343A45]">
                          {ag.state}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#737D8C] truncate">
                        {ag.current_activity}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeLeftTab === 'tasks' && <TaskPanel />}

            {activeLeftTab === 'meetings' && (
              <div className="p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#E8EBF0] flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-[#4778D0]" /> Boardroom ({meetings.length})
                  </span>
                  <button
                    onClick={() => void triggerBoardroomMeeting()}
                    className="px-2 py-1 rounded-md bg-[#4778D0] hover:bg-[#3b66b5] text-white font-semibold text-[10px]"
                  >
                    Convene Now
                  </button>
                </div>

                {meetings.length === 0 ? (
                  <div className="p-4 rounded-md bg-[#101216] border border-[#343A45] text-xs text-[#737D8C] text-center">
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
                      className="p-2.5 rounded-md bg-[#101216] hover:bg-[#1B2028] border border-[#343A45] cursor-pointer space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#E8EBF0]">{m.title}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#299B83]/20 text-[#299B83]">
                          {m.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#737D8C]">
                        {m.participants.length} participants • {m.messages.length} turns •{' '}
                        {m.presentations.length} slides
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeLeftTab === 'factory' && <FactoryPanel />}

            {activeLeftTab === 'history' && <ActivityFeed />}
          </div>
        </div>
      )}
    </aside>
  );
};
