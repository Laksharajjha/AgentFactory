import React from 'react';
import { Coins, Cpu, Layers, Zap } from 'lucide-react';
import { useWorldStore } from '../state/worldStore';

export const TokenUsagePanel: React.FC = () => {
  const tokenUsage = useWorldStore((s) => s.tokenUsage);
  const setSettingsModalOpen = useWorldStore((s) => s.setSettingsModalOpen);

  if (!tokenUsage) {
    return (
      <div className="p-4 text-xs text-slate-400">Loading token economics ledger...</div>
    );
  }

  const budgetPct = Math.min(
    100,
    Math.round((tokenUsage.total_tokens_used / Math.max(1, tokenUsage.global_token_budget)) * 100)
  );

  return (
    <div className="p-4 space-y-4 text-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-amber-400" /> Token Economics & LLM Ledger
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Active Model: <span className="text-sky-300 font-mono">{tokenUsage.active_model}</span>
          </p>
        </div>
        <button
          onClick={() => setSettingsModalOpen(true)}
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-amber-300 border border-slate-700"
        >
          Configure Key
        </button>
      </div>

      {/* Provider Status Banner */}
      <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] flex items-center justify-between">
        <span className="text-slate-400">Gateway Mode:</span>
        <span className="font-mono text-emerald-300 font-semibold truncate ml-2">
          {tokenUsage.provider_status}
        </span>
      </div>

      {/* Global Workforce Budget */}
      <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-medium">Global Workforce Token Budget</span>
          <span className="font-mono text-white font-bold">
            {tokenUsage.total_tokens_used.toLocaleString()} /{' '}
            {tokenUsage.global_token_budget.toLocaleString()} ({budgetPct}%)
          </span>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
            style={{ width: `${budgetPct}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1 text-[10px]">
          <div className="bg-slate-950/70 p-2 rounded border border-slate-800/80">
            <div className="text-slate-400">Input Tokens</div>
            <div className="font-mono font-bold text-slate-200 mt-0.5">
              {tokenUsage.total_input_tokens.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-950/70 p-2 rounded border border-slate-800/80">
            <div className="text-slate-400">Output Tokens</div>
            <div className="font-mono font-bold text-slate-200 mt-0.5">
              {tokenUsage.total_output_tokens.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-950/70 p-2 rounded border border-slate-800/80">
            <div className="text-slate-400">Workforce Calls</div>
            <div className="font-mono font-bold text-amber-300 mt-0.5">
              {tokenUsage.llm_calls_made} / {tokenUsage.max_llm_calls}
            </div>
          </div>
        </div>
      </div>

      {/* Per-Agent Token Allocation */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-sky-400" /> Per-Agent Token Allocation
        </div>
        <div className="space-y-1.5">
          {tokenUsage.by_agent.map((ag) => (
            <div
              key={ag.agent_id}
              className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800/90 space-y-1"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">
                  {ag.agent_name} <span className="text-[10px] text-slate-400">({ag.role})</span>
                </span>
                <span className="font-mono text-[11px] text-slate-300">
                  {ag.tokens_used.toLocaleString()} / {ag.token_budget.toLocaleString()} tok
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, ag.utilization_pct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent LLM Request Ledger */}
      {tokenUsage.recent_requests.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-400" /> Recorded Request Telemetry
          </div>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {tokenUsage.recent_requests.map((req) => (
              <div
                key={req.id}
                className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-[10px] flex items-center justify-between"
              >
                <div>
                  <div className="font-mono text-slate-200 font-semibold">{req.operation}</div>
                  <div className="text-slate-500">
                    {req.model_id} • {req.duration_ms}ms
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-amber-300 font-bold">+{req.total_tokens} tok</div>
                  <div className="text-slate-400 flex items-center justify-end gap-0.5">
                    <Coins className="w-2.5 h-2.5" />
                    {req.is_live_api ? `$${(req.estimated_cost_usd || 0).toFixed(5)}` : 'local-sim'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
