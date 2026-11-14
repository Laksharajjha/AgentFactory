import React from 'react';
import {
  AlertTriangle,
  Award,
  Building2,
  CheckCircle2,
  Cpu,
  Rocket,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react';
import { useWorldStore } from '../state/worldStore';

export const WorkforceMetrics: React.FC = () => {
  const ceoOverview = useWorldStore((s) => s.ceoOverview);
  const finalReport = useWorldStore((s) => s.finalReport);
  const selectAgent = useWorldStore((s) => s.selectAgent);
  const selectRoom = useWorldStore((s) => s.selectRoom);
  const setFactoryModalOpen = useWorldStore((s) => s.setFactoryModalOpen);
  const triggerBoardroomMeeting = useWorldStore((s) => s.triggerBoardroomMeeting);

  if (!ceoOverview) {
    return (
      <div className="p-4 text-xs text-slate-400">
        Connecting to Alex&apos;s CEO Office Command Centre...
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 text-slate-200">
      {/* CEO Command Centre Banner */}
      <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/50 border border-sky-500/30 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
            CEO Command Centre
          </span>
          <button
            onClick={() => selectRoom('ceo_office', true)}
            className="text-[11px] text-amber-300 hover:underline font-medium"
          >
            Focus CEO Office
          </button>
        </div>
        <div className="text-sm font-bold text-white">{ceoOverview.orchestrator}</div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400">Company Health</div>
            <div className="text-sm font-bold text-emerald-400 mt-0.5">
              {ceoOverview.company_health_score}% ({ceoOverview.company_health_status})
            </div>
          </div>
          <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400">Token Expenditure</div>
            <div className="text-sm font-bold text-amber-300 font-mono mt-0.5">
              {ceoOverview.token_expenditure.used.toLocaleString()} tok
            </div>
          </div>
        </div>
      </div>

      {/* Active Project Card */}
      <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-amber-400" /> Active Initiative
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
            {ceoOverview.active_project.status}
          </span>
        </div>
        <div className="text-xs font-semibold text-sky-300">
          {ceoOverview.active_project.name}
        </div>
        <p className="text-[11px] text-slate-300 leading-relaxed">
          {ceoOverview.active_project.objective}
        </p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setFactoryModalOpen(true)}
            className="flex-1 py-1.5 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 transition"
          >
            <Rocket className="w-3.5 h-3.5" /> Submit New Project
          </button>
          <button
            onClick={() => void triggerBoardroomMeeting()}
            className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 border border-slate-700 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Call Meeting
          </button>
        </div>
      </div>

      {/* Employee Workload */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-sky-400" /> Employee Workload & Locations
        </div>
        <div className="space-y-1.5">
          {ceoOverview.employee_workload.map((emp) => (
            <div
              key={emp.agent_id}
              onClick={() => selectAgent(emp.agent_id, true)}
              className="p-2.5 rounded-xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800/90 cursor-pointer flex items-center justify-between text-xs transition"
            >
              <div>
                <div className="font-bold text-white">{emp.name}</div>
                <div className="text-[10px] text-slate-400">
                  {emp.role} • {emp.room_id.replace(/_/g, ' ')}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                  {emp.state}
                </span>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                  {emp.tasks_completed} done • {emp.tokens_used} tok
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Major Risks */}
      <div className="p-3 rounded-xl bg-red-950/20 border border-red-800/40 space-y-2">
        <div className="text-[11px] font-semibold text-red-300 uppercase tracking-wider flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-red-400" /> Tracked Architectural & Security Risks
        </div>
        <ul className="space-y-1.5">
          {ceoOverview.major_risks.map((risk, idx) => (
            <li key={idx} className="text-[11px] text-slate-300 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>{risk}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Ratified Decisions */}
      {ceoOverview.ratified_decisions.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Executive Ratified Decisions (
            {ceoOverview.ratified_decisions.length})
          </div>
          {ceoOverview.ratified_decisions.map((dec) => (
            <div
              key={dec.id}
              className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 space-y-1"
            >
              <div className="text-xs font-bold text-white">{dec.title}</div>
              <div className="text-[11px] text-slate-300">{dec.rationale}</div>
            </div>
          ))}
        </div>
      )}

      {/* Completed Deliverables & Final Dossier */}
      {ceoOverview.completed_deliverables.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5" /> Completed Workforce Deliverables (
            {ceoOverview.completed_deliverables.length})
          </div>
          {ceoOverview.completed_deliverables.map((deliv, i) => (
            <div
              key={i}
              className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">{deliv.task_title}</span>
                <span className="text-[10px] text-sky-300">{deliv.agent}</span>
              </div>
              {deliv.summary && (
                <p className="text-[11px] text-slate-300 leading-relaxed">{deliv.summary}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {finalReport && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40 space-y-2">
          <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
            <Cpu className="w-4 h-4" /> Final Executive Dossier Ready
          </div>
          <p className="text-[11px] text-slate-200 leading-relaxed">
            {String(finalReport.executive_summary || '')}
          </p>
        </div>
      )}
    </div>
  );
};
