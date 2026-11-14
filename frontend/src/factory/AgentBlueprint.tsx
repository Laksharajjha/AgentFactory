import React from 'react';
import { Cpu, ShieldCheck, Wrench } from 'lucide-react';

interface AgentBlueprintProps {
  blueprint: {
    agent_key: string;
    name: string;
    role: string;
    department: string;
    home_room_id: string;
    capabilities: string[];
    tools: string[];
    token_budget: number;
    avatar_config?: {
      accent_color?: string;
      badge?: string;
    };
  };
}

export const AgentBlueprint: React.FC<AgentBlueprintProps> = ({ blueprint }) => {
  const accent = blueprint.avatar_config?.accent_color || '#3b82f6';
  return (
    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
            style={{ backgroundColor: accent }}
          >
            {blueprint.avatar_config?.badge || blueprint.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <div className="text-xs font-bold text-white">{blueprint.name}</div>
            <div className="text-[10px] text-slate-400">
              {blueprint.role} • {blueprint.department}
            </div>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-amber-300 border border-slate-800 flex items-center gap-1">
          <Cpu className="w-3 h-3" /> {blueprint.token_budget.toLocaleString()} tok
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {blueprint.capabilities.map((cap) => (
          <span
            key={cap}
            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 flex items-center gap-1"
          >
            <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
            {cap.replace(/_/g, ' ')}
          </span>
        ))}
        {blueprint.tools.map((t) => (
          <span
            key={t}
            className="text-[9px] px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-700/40 font-mono flex items-center gap-1"
          >
            <Wrench className="w-2.5 h-2.5" />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
};
