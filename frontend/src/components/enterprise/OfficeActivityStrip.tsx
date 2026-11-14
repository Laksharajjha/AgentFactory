import React from 'react';
import {
  Activity,
  FileArchive,
  GitBranch,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { useWorldStore } from '../../state/worldStore';

export const OfficeActivityStrip: React.FC = () => {
  const agents = useWorldStore((s) => s.agents);
  const queueItems = useWorldStore((s) => s.queueItems);
  const executions = useWorldStore((s) => s.executions);
  const artifacts = useWorldStore((s) => s.artifacts);
  const systemCapacity = useWorldStore((s) => s.systemCapacity);
  const leftNavCollapsed = useWorldStore((s) => s.leftNavCollapsed);
  const setLeftNavCollapsed = useWorldStore((s) => s.setLeftNavCollapsed);
  const rightInspectorCollapsed = useWorldStore((s) => s.rightInspectorCollapsed);
  const setRightInspectorCollapsed = useWorldStore((s) => s.setRightInspectorCollapsed);
  const setActiveAppSection = useWorldStore((s) => s.setActiveAppSection);

  const workingCount = agents.filter((a) =>
    ['WORKING', 'PLANNING', 'MOVING', 'TASK_ASSIGNED'].includes(a.state)
  ).length;
  const idleCount = agents.filter((a) => a.state === 'IDLE').length;
  const meetingCount = agents.filter((a) =>
    ['IN_MEETING', 'PRESENTING'].includes(a.state)
  ).length;
  const queuedCount =
    systemCapacity?.queued_executions ??
    queueItems.filter((q) => q.status === 'QUEUED').length;
  const activeExecCount =
    systemCapacity?.active_executions ??
    executions.filter((e) => ['ADMITTED', 'STARTING', 'RUNNING', 'VERIFYING'].includes(e.status))
      .length;

  return (
    <div className="absolute top-3 left-3 right-3 z-20 pointer-events-none flex items-center justify-between gap-2">
      {/* Left Drawer Toggle + Compact Workforce Activity Strip (Part 15 Specification) */}
      <div className="pointer-events-auto flex items-center gap-1.5 bg-[#151920]/90 backdrop-blur-md border border-[#343A45] rounded-md px-2.5 py-1.5 text-[11px] text-[#E8EBF0] shadow-sm">
        <button
          onClick={() => setLeftNavCollapsed(!leftNavCollapsed)}
          title={leftNavCollapsed ? 'Expand Navigation Drawer' : 'Collapse Navigation Drawer'}
          className="p-1 rounded hover:bg-[#22262E] text-[#A5ACB8] hover:text-[#E8EBF0]"
        >
          {leftNavCollapsed ? (
            <PanelLeftOpen className="w-3.5 h-3.5" />
          ) : (
            <PanelLeftClose className="w-3.5 h-3.5" />
          )}
        </button>

        <div className="h-3.5 w-px bg-[#343A45]" />

        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#299B83]" />
            <span className="text-[#A5ACB8]">Working:</span>
            <strong className="text-[#E8EBF0]">{workingCount}</strong>
          </span>

          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#737D8C]" />
            <span className="text-[#A5ACB8]">Idle:</span>
            <strong className="text-[#E8EBF0]">{idleCount}</strong>
          </span>

          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D29A43]" />
            <span className="text-[#A5ACB8]">In Meetings:</span>
            <strong className="text-[#E8EBF0]">{meetingCount}</strong>
          </span>

          <span className="hidden md:flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-[#4778D0]" />
            <span className="text-[#A5ACB8]">Active Execs:</span>
            <strong className="text-[#E8EBF0]">
              {activeExecCount}/{systemCapacity?.max_concurrent_workforces ?? 2}
            </strong>
          </span>

          <button
            onClick={() => setActiveAppSection('executions')}
            className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1B2028] hover:bg-[#22262E] border border-[#343A45] text-[#D29A43]"
          >
            <span>Queued: {queuedCount}</span>
          </button>
        </div>
      </div>

      {/* Right Quick Shortcuts & Inspector Collapse Toggle */}
      <div className="pointer-events-auto flex items-center gap-1.5 bg-[#151920]/90 backdrop-blur-md border border-[#343A45] rounded-md px-2 py-1 text-[11px]">
        <button
          onClick={() => setActiveAppSection('artifacts')}
          className="px-2 py-1 rounded hover:bg-[#22262E] text-[#A5ACB8] hover:text-[#E8EBF0] flex items-center gap-1 font-mono"
        >
          <FileArchive className="w-3 h-3 text-[#D29A43]" />
          <span>Artifacts ({artifacts.length})</span>
        </button>

        <button
          onClick={() => setActiveAppSection('github')}
          className="px-2 py-1 rounded hover:bg-[#22262E] text-[#A5ACB8] hover:text-[#E8EBF0] flex items-center gap-1 font-mono"
        >
          <GitBranch className="w-3 h-3 text-[#299B83]" />
          <span>GitHub PRs</span>
        </button>

        <div className="h-3.5 w-px bg-[#343A45]" />

        <button
          onClick={() => setRightInspectorCollapsed(!rightInspectorCollapsed)}
          title={rightInspectorCollapsed ? 'Open Inspector Panel' : 'Collapse Inspector Panel'}
          className="p-1 rounded hover:bg-[#22262E] text-[#A5ACB8] hover:text-[#E8EBF0]"
        >
          {rightInspectorCollapsed ? (
            <PanelRightOpen className="w-3.5 h-3.5" />
          ) : (
            <PanelRightClose className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
};
