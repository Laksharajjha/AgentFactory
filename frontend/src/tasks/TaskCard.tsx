import React from 'react';
import { CheckCircle2, Clock, User } from 'lucide-react';
import { useWorldStore } from '../state/worldStore';
import { TaskItem } from '../types/task';

interface TaskCardProps {
  task: TaskItem;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const selectTask = useWorldStore((s) => s.selectTask);
  const selectAgent = useWorldStore((s) => s.selectAgent);
  const selectedTaskId = useWorldStore((s) => s.selectedTaskId);

  const isSelected = selectedTaskId === task.id;

  const statusStyles: Record<string, string> = {
    COMPLETED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    IN_PROGRESS: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    FAILED: 'bg-red-500/20 text-red-300 border-red-500/40',
    PENDING: 'bg-slate-800 text-slate-300 border-slate-700',
  };

  return (
    <div
      onClick={() => selectTask(task.id)}
      className={`p-3 rounded-xl border cursor-pointer transition space-y-2 ${
        isSelected
          ? 'bg-slate-900 border-amber-400/80 shadow-lg'
          : 'bg-slate-900/60 border-slate-800/90 hover:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-bold text-white leading-snug">{task.title}</div>
        <span
          className={`text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
            statusStyles[task.status] || statusStyles.PENDING
          }`}
        >
          {task.status}
        </span>
      </div>

      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{task.description}</p>

      <div className="flex items-center justify-between text-[10px] text-slate-300 pt-1">
        {task.assigned_agent_name ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (task.assigned_agent_id) selectAgent(task.assigned_agent_id, true);
            }}
            className="flex items-center gap-1 text-sky-300 hover:underline"
          >
            <User className="w-3 h-3" /> {task.assigned_agent_name}
          </button>
        ) : (
          <span className="text-slate-500">Unassigned</span>
        )}

        <span className="font-mono text-slate-400 flex items-center gap-1">
          {task.status === 'COMPLETED' ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          ) : (
            <Clock className="w-3 h-3 text-amber-400" />
          )}
          {task.progress}%
        </span>
      </div>

      <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            task.status === 'COMPLETED' ? 'bg-emerald-400' : 'bg-amber-400'
          }`}
          style={{ width: `${task.progress}%` }}
        />
      </div>
    </div>
  );
};
