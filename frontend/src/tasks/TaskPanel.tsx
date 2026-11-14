import React from 'react';
import { CheckSquare, PlusCircle } from 'lucide-react';
import { useWorldStore } from '../state/worldStore';
import { TaskCard } from './TaskCard';
import { TaskDependencyGraph } from './TaskDependencyGraph';

export const TaskPanel: React.FC = () => {
  const tasks = useWorldStore((s) => s.tasks);
  const setFactoryModalOpen = useWorldStore((s) => s.setFactoryModalOpen);

  const completed = tasks.filter((t) => t.status === 'COMPLETED').length;

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-white flex items-center gap-1.5">
          <CheckSquare className="w-4 h-4 text-amber-400" />
          Workstream Tasks ({completed}/{tasks.length})
        </div>
        <button
          onClick={() => setFactoryModalOpen(true)}
          className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-semibold flex items-center gap-1"
        >
          <PlusCircle className="w-3 h-3" /> New Mission
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="p-6 text-center rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
          <p className="text-xs text-slate-400">
            No active tasks dispatched yet. Submit a project objective in the Factory to generate workstreams.
          </p>
          <button
            onClick={() => setFactoryModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs"
          >
            Launch Workforce Mission
          </button>
        </div>
      ) : (
        <>
          <TaskDependencyGraph tasks={tasks} />
          <div className="space-y-2">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
