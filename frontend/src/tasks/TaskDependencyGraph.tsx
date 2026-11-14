import React from 'react';
import { ArrowDown, GitCommit } from 'lucide-react';
import { TaskItem } from '../types/task';

interface TaskDependencyGraphProps {
  tasks: TaskItem[];
}

export const TaskDependencyGraph: React.FC<TaskDependencyGraphProps> = ({ tasks }) => {
  if (tasks.length === 0) return null;

  const rootTasks = tasks.filter((t) => !t.dependencies || t.dependencies.length === 0);
  const dependentTasks = tasks.filter((t) => t.dependencies && t.dependencies.length > 0);

  return (
    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-2">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <GitCommit className="w-3.5 h-3.5 text-amber-400" /> Execution Dependency Topology
      </div>

      <div className="space-y-1.5">
        {rootTasks.map((rt) => (
          <div
            key={rt.id}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-amber-500/30 flex items-center justify-between text-[11px]"
          >
            <span className="font-semibold text-amber-300 truncate">{rt.title}</span>
            <span className="text-[9px] font-mono text-slate-400 ml-2 shrink-0">
              {rt.assigned_agent_name || 'Root'}
            </span>
          </div>
        ))}

        {dependentTasks.length > 0 && (
          <>
            <div className="flex justify-center py-0.5">
              <ArrowDown className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="grid grid-cols-1 gap-1.5 pl-2 border-l-2 border-slate-800">
              {dependentTasks.map((dt) => (
                <div
                  key={dt.id}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-[11px]"
                >
                  <span className="text-slate-200 truncate">{dt.title}</span>
                  <span className="text-[9px] font-mono text-sky-300 ml-2 shrink-0">
                    {dt.assigned_agent_name}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
