import React, { useMemo } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  Monitor,
  Terminal,
  User,
  X,
} from 'lucide-react';
import { useWorldStore } from '../state/worldStore';

export const ExpandedScreenModal: React.FC = () => {
  const expandedScreenRoomId = useWorldStore((s) => s.expandedScreenRoomId);
  const setExpandedScreenRoomId = useWorldStore((s) => s.setExpandedScreenRoomId);
  const rooms = useWorldStore((s) => s.rooms);
  const agents = useWorldStore((s) => s.agents);
  const tasks = useWorldStore((s) => s.tasks);
  const tokenUsage = useWorldStore((s) => s.tokenUsage);
  const ceoOverview = useWorldStore((s) => s.ceoOverview);

  const room = useMemo(
    () => rooms.find((r) => r.id === expandedScreenRoomId) || null,
    [rooms, expandedScreenRoomId]
  );

  const roomAgents = useMemo(
    () =>
      agents.filter(
        (a) => a.current_room_id === expandedScreenRoomId || a.home_room_id === expandedScreenRoomId
      ),
    [agents, expandedScreenRoomId]
  );

  const roomTasks = useMemo(() => {
    const agentIds = new Set(roomAgents.map((a) => a.id));
    return tasks.filter(
      (t) => t.target_room_id === expandedScreenRoomId || (t.assigned_agent_id && agentIds.has(t.assigned_agent_id))
    );
  }, [tasks, roomAgents, expandedScreenRoomId]);

  if (!expandedScreenRoomId || !room) return null;

  const primaryAgent = roomAgents[0] || null;

  return (
    <div
      onClick={() => setExpandedScreenRoomId(null)}
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-2xl bg-[#0d131f] border border-sky-500/40 shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-slate-100"
      >
        {/* Top Terminal Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">{room.name} — Live Workstation Console</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  LIVE DATA FEED
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" /> Updated: {new Date().toLocaleTimeString()}
                </span>
                {primaryAgent && (
                  <span className="flex items-center gap-1 text-sky-300">
                    <User className="w-3 h-3" /> Assigned Employee: {primaryAgent.name} ({primaryAgent.role})
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setExpandedScreenRoomId(null)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5"
          >
            <X className="w-4 h-4" /> Close [Esc]
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Active Room Displays */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-400 uppercase flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" /> Workstation Telemetry
              </div>
              <div className="text-xs text-white font-medium">{room.description}</div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {room.displays.map((d) => (
                  <span
                    key={d}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-sky-300 border border-slate-800"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-400 uppercase flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-amber-400" /> Associated Agent & Token State
              </div>
              {primaryAgent ? (
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{primaryAgent.name}</span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      {primaryAgent.state}
                    </span>
                  </div>
                  <div className="text-slate-300">{primaryAgent.current_activity}</div>
                  <div className="text-[11px] font-mono text-slate-400">
                    Tokens: {primaryAgent.tokens_used.toLocaleString()} /{' '}
                    {primaryAgent.token_budget.toLocaleString()} • Tasks Done: {primaryAgent.tasks_completed}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  Global Workforce Tokens: {(tokenUsage?.total_tokens_used || 0).toLocaleString()} /{' '}
                  {(tokenUsage?.global_token_budget || 100000).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {/* Live Tasks & Deliverables on this Workstation */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-sky-400" /> Live Workstream Tasks & Code Artifacts (
              {roomTasks.length})
            </div>

            {roomTasks.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-2">
                <div className="font-mono text-emerald-400">
                  $ forge-monitor --room {room.id} --status standby
                </div>
                <p className="text-slate-400">
                  Workstation is online and standing by. Submit a project in the Workforce Factory to stream live
                  task artifacts to this terminal.
                </p>
              </div>
            ) : (
              roomTasks.map((t) => {
                const out = (t.structured_output || {}) as Record<string, unknown>;
                const findings = (out.key_findings as string[]) || [];
                const snippet = String(out.code_or_spec_snippet || '');
                return (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {t.title}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        {t.status} ({t.progress}%)
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{t.result_summary || t.description}</p>

                    {findings.length > 0 && (
                      <div className="space-y-1 bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                        <div className="text-[10px] font-semibold text-amber-300 uppercase">
                          Key Technical Findings
                        </div>
                        <ul className="list-disc list-inside text-[11px] text-slate-200 space-y-0.5">
                          {findings.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {snippet && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-mono text-sky-400 flex items-center gap-1">
                          <Code2 className="w-3 h-3" /> Verified Specification / Code Contract
                        </div>
                        <pre className="p-3 rounded-lg bg-[#060911] border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto">
                          {snippet}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {room.id === 'ceo_office' && ceoOverview && (
            <div className="p-4 rounded-xl bg-sky-950/30 border border-sky-500/30 space-y-2">
              <div className="text-xs font-bold text-sky-300 uppercase">
                CEO Executive Command Summary
              </div>
              <div className="text-xs text-slate-200">
                Company Health Score: <strong className="text-emerald-400">{ceoOverview.company_health_score}%</strong> •
                Active Project: <strong>{ceoOverview.active_project.name}</strong> ({ceoOverview.active_project.status})
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
