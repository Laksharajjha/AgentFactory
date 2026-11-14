import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock,
  Cpu,
  MapPin,
  Pause,
  Play,
  Send,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { useWorldStore } from '../state/worldStore';
import { AgentProfile } from '../types/agent';

interface CharacterInspectorProps {
  agent: AgentProfile;
}

export const CharacterInspector: React.FC<CharacterInspectorProps> = ({ agent }) => {
  const [instructionText, setInstructionText] = useState('');
  const [assignAsTask, setAssignAsTask] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'tasks' | 'memory' | 'performance'>('overview');

  const rooms = useWorldStore((s) => s.rooms);
  const tasks = useWorldStore((s) => s.tasks);
  const sendAgentInstruction = useWorldStore((s) => s.sendAgentInstruction);
  const toggleAgentPause = useWorldStore((s) => s.toggleAgentPause);
  const selectRoom = useWorldStore((s) => s.selectRoom);

  const currentRoom = useMemo(
    () => rooms.find((r) => r.id === agent.current_room_id),
    [rooms, agent.current_room_id]
  );

  const agentTasks = useMemo(
    () => tasks.filter((t) => t.assigned_agent_id === agent.id),
    [tasks, agent.id]
  );

  const completedTasks = useMemo(
    () => agentTasks.filter((t) => t.status === 'COMPLETED'),
    [agentTasks]
  );

  const pendingTasks = useMemo(
    () => agentTasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'FAILED'),
    [agentTasks]
  );

  const currentTask = useMemo(
    () => agentTasks.find((t) => t.id === agent.current_task_id) || pendingTasks[0] || null,
    [agentTasks, agent.current_task_id, pendingTasks]
  );

  const timeInActivity = useMemo(() => {
    const changed = new Date(agent.state_changed_at).getTime();
    if (Number.isNaN(changed)) return 'Just now';
    const diffSec = Math.max(1, Math.floor((Date.now() - changed) / 1000));
    if (diffSec < 60) return `${diffSec}s in state`;
    return `${Math.floor(diffSec / 60)}m ${diffSec % 60}s in state`;
  }, [agent.state_changed_at, agent.state]);

  // Real execution statistics only — never fabricate metrics
  const totalExecuted = agent.tasks_completed + agent.tasks_failed;
  const successRateDisplay =
    totalExecuted > 0
      ? `${Math.round((agent.tasks_completed / totalExecuted) * 100)}% (${agent.tasks_completed}/${totalExecuted})`
      : 'No tasks executed yet';

  const handleSendDirective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instructionText.trim()) return;
    await sendAgentInstruction(agent.id, instructionText.trim(), assignAsTask);
    setInstructionText('');
  };

  const accent = agent.avatar_config?.accent_color || '#3b82f6';

  return (
    <div className="flex flex-col h-full text-slate-200">
      {/* IDENTITY HEADER */}
      <div className="p-4 border-b border-slate-800/90 bg-slate-900/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-inner border border-white/15 shrink-0"
              style={{ backgroundColor: accent }}
            >
              {agent.avatar_config?.badge || agent.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{agent.name}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                  {agent.state}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">{agent.role}</p>
              <p className="text-[11px] text-slate-400">{agent.department}</p>
            </div>
          </div>

          <button
            onClick={() => void toggleAgentPause(agent)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition ${
              agent.state === 'PAUSED'
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
                : 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {agent.state === 'PAUSED' ? (
              <>
                <Play className="w-3.5 h-3.5" /> Resume
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5" /> Pause
              </>
            )}
          </button>
        </div>

        <p className="mt-2.5 text-[11px] text-slate-300 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          {agent.personality}
        </p>

        {/* Sub-navigation tabs */}
        <div className="grid grid-cols-4 gap-1 mt-3 bg-slate-950/80 p-1 rounded-lg border border-slate-800/80 text-[11px]">
          {(['overview', 'tasks', 'memory', 'performance'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`py-1 rounded font-medium capitalize transition ${
                activeSubTab === tab
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* SCROLLABLE BODY */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeSubTab === 'overview' && (
          <>
            {/* CURRENT STATE */}
            <div className="bg-slate-900/60 border border-slate-800/90 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-400" /> CURRENT STATE
                </span>
                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {timeInActivity}
                </span>
              </div>

              <div className="text-xs text-white font-medium bg-slate-950/80 p-2 rounded border border-slate-800">
                {agent.current_activity}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div
                  onClick={() => selectRoom(agent.current_room_id, true)}
                  className="bg-slate-950/60 p-2 rounded border border-slate-800/80 cursor-pointer hover:border-slate-600"
                >
                  <div className="text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-sky-400" /> Location
                  </div>
                  <div className="font-semibold text-slate-200 truncate mt-0.5">
                    {currentRoom?.name || agent.current_room_id}
                  </div>
                </div>

                <div className="bg-slate-950/60 p-2 rounded border border-slate-800/80">
                  <div className="text-slate-400 flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-emerald-400" /> Token Budget
                  </div>
                  <div className="font-semibold text-slate-200 mt-0.5 font-mono">
                    {agent.tokens_used.toLocaleString()} / {agent.token_budget.toLocaleString()}
                  </div>
                </div>
              </div>

              {currentTask && (
                <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-amber-300 font-semibold">Active Task</span>
                    <span className="font-mono text-slate-400">{currentTask.progress}%</span>
                  </div>
                  <div className="text-xs font-medium text-white">{currentTask.title}</div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all duration-300"
                      style={{ width: `${currentTask.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* CAPABILITIES & TOOLS */}
            <div className="bg-slate-900/60 border border-slate-800/90 rounded-xl p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" /> CAPABILITIES & APPROVED TOOLS
              </div>
              <div className="flex flex-wrap gap-1.5">
                {agent.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-200 border border-slate-700/70"
                  >
                    {cap.replace(/_/g, ' ')}
                  </span>
                ))}
                {agent.tools.map((tool) => (
                  <span
                    key={tool}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-sky-950/80 text-sky-300 border border-sky-700/50 font-mono"
                  >
                    tool:{tool}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {activeSubTab === 'tasks' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Assigned ({agentTasks.length})</span>
              <span>Completed ({completedTasks.length})</span>
              <span>Pending ({pendingTasks.length})</span>
            </div>
            {agentTasks.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-6 bg-slate-900/40 rounded-xl border border-slate-800/60">
                No tasks assigned to {agent.name} yet.
              </div>
            ) : (
              agentTasks.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white">{t.title}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        t.status === 'COMPLETED'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : t.status === 'FAILED'
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{t.description}</p>
                  {t.result_summary && (
                    <div className="text-[11px] text-emerald-300 bg-emerald-950/30 border border-emerald-800/40 rounded p-2 mt-1">
                      {t.result_summary}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeSubTab === 'memory' && (
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-amber-400" /> PERSISTENT AGENT MEMORY ({agent.memories.length})
            </div>
            {agent.memories.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-6">No memory entries recorded yet.</div>
            ) : (
              agent.memories.map((m) => (
                <div
                  key={m.id}
                  className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/90 space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">
                      {m.memory_type}
                    </span>
                    <span className="text-slate-500">
                      {new Date(m.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-200 leading-relaxed">{m.content}</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeSubTab === 'performance' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="text-[11px] text-slate-400">Tasks Completed</div>
                <div className="text-lg font-bold text-white mt-0.5">{agent.tasks_completed}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="text-[11px] text-slate-400">Verified Success Rate</div>
                <div className="text-xs font-bold text-emerald-400 mt-1.5">{successRateDisplay}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="text-[11px] text-slate-400">Meetings Attended</div>
                <div className="text-lg font-bold text-amber-300 mt-0.5">{agent.meetings_attended}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="text-[11px] text-slate-400">Iterations Used</div>
                <div className="text-lg font-bold text-sky-300 mt-0.5">
                  {agent.iterations_used} / {agent.max_iterations}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Token Consumption</span>
                <span className="font-mono text-slate-200">
                  {agent.tokens_used.toLocaleString()} / {agent.token_budget.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-400"
                  style={{
                    width: `${Math.min(100, (agent.tokens_used / Math.max(1, agent.token_budget)) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {agent.recent_error ? (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Recent Execution Error</div>
                  <div className="text-[11px] mt-0.5">{agent.recent_error}</div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-800/40 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Zero execution errors recorded for {agent.name}.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ACTIONS FOOTER: SEND INSTRUCTION / ASSIGN TASK */}
      <form
        onSubmit={handleSendDirective}
        className="p-3.5 border-t border-slate-800/90 bg-slate-900/70 space-y-2"
      >
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-300 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-amber-400" /> Direct Agent Action
          </span>
          <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={assignAsTask}
              onChange={(e) => setAssignAsTask(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-amber-500"
            />
            <span>Execute as Task</span>
          </label>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={instructionText}
            onChange={(e) => setInstructionText(e.target.value)}
            placeholder={`Instruct ${agent.name} or assign task...`}
            className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1 transition"
          >
            <Send className="w-3.5 h-3.5" /> Send
          </button>
        </div>
      </form>
    </div>
  );
};
