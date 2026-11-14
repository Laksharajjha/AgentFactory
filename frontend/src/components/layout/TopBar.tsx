import React, { useState } from 'react';
import {
  Activity,
  Bell,
  Boxes,
  Building2,
  Cpu,
  Footprints,
  KeyRound,
  Rocket,
  Settings,
  Sun,
  Users,
  Video,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAgentState } from '../../hooks/useAgentState';
import { API_BASE_URL } from '../../config';
import { useMeeting } from '../../hooks/useMeeting';
import { useEventStore } from '../../state/eventStore';
import { useWorldStore, DaylightPreset, QualityPreset } from '../../state/worldStore';

export const TopBar: React.FC = () => {
  const workforceName = useWorldStore((s) => s.workforceName);
  const tokenUsage = useWorldStore((s) => s.tokenUsage);
  const viewMode = useWorldStore((s) => s.viewMode);
  const setViewMode = useWorldStore((s) => s.setViewMode);
  const daylightPreset = useWorldStore((s) => s.daylightPreset);
  const setDaylightPreset = useWorldStore((s) => s.setDaylightPreset);
  const qualityPreset = useWorldStore((s) => s.qualityPreset);
  const setQualityPreset = useWorldStore((s) => s.setQualityPreset);
  const devPerfOpen = useWorldStore((s) => s.devPerfOpen);
  const setDevPerfOpen = useWorldStore((s) => s.setDevPerfOpen);
  const audioMuted = useWorldStore((s) => s.audioMuted);
  const setAudioMuted = useWorldStore((s) => s.setAudioMuted);
  const focusRoom = useWorldStore((s) => s.focusRoom);

  const settingsModalOpen = useWorldStore((s) => s.settingsModalOpen);
  const setSettingsModalOpen = useWorldStore((s) => s.setSettingsModalOpen);
  const setFactoryModalOpen = useWorldStore((s) => s.setFactoryModalOpen);
  const fetchSnapshot = useWorldStore((s) => s.fetchSnapshot);

  const events = useEventStore((s) => s.events);
  const { agents, activeCount } = useAgentState();
  const { isMeetingLive, splitViewOpen, setSplitViewOpen } = useMeeting();

  const isLiveGeminiMode = Boolean(
    tokenUsage?.provider_status?.startsWith('LIVE GEMINI MODE')
  );

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelInput, setModelInput] = useState(
    tokenUsage?.active_model || 'gemini-3.1-flash-lite-preview'
  );
  const [enableLiveToggle, setEnableLiveToggle] = useState(isLiveGeminiMode);
  const [savingSettings, setSavingSettings] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await fetch(`${API_BASE_URL}/api/settings/llm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gemini_api_key: apiKeyInput.trim() ? apiKeyInput.trim() : undefined,
          gemini_model: modelInput,
          enable_live_execution: enableLiveToggle,
        }),
      });
      await fetchSnapshot();
      setSettingsModalOpen(false);
      setApiKeyInput('');
    } finally {
      setSavingSettings(false);
    }
  };

  const cycleDaylightPreset = () => {
    const order: DaylightPreset[] = ['MORNING', 'DAYTIME', 'AFTERNOON'];
    const next = order[(order.indexOf(daylightPreset) + 1) % order.length];
    setDaylightPreset(next);
  };

  return (
    <>
      <header className="h-14 px-4 bg-[#0d1119]/95 backdrop-blur-md border-b border-slate-800/90 flex items-center justify-between select-none z-30 shrink-0">
        {/* Left: PROJECT FORGE Brand & Prominent Mode Switch */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Boxes className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-wider text-white">
                  PROJECT FORGE
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  2.1 LIVING OFFICE
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                {workforceName}
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          {/* Prominent DOLLHOUSE | WALK AROUND Switcher */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-700/80 shadow-inner">
            <button
              onClick={() => setViewMode('DOLLHOUSE')}
              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                viewMode === 'DOLLHOUSE'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>DOLLHOUSE</span>
            </button>
            <button
              onClick={() => setViewMode('WALK')}
              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                viewMode === 'WALK'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Footprints className="w-3.5 h-3.5" />
              <span>WALK AROUND</span>
            </button>
          </div>

          {/* Daylight Preset Button */}
          <button
            onClick={cycleDaylightPreset}
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-sky-300 transition"
            title="Cycle Natural Daylight Preset (Morning / Daytime / Afternoon)"
          >
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono text-[11px]">{daylightPreset}</span>
          </button>

          {/* Explicit AI Provider Status Badge (DEMO MODE vs LIVE GEMINI MODE) */}
          <button
            onClick={() => setSettingsModalOpen(true)}
            className={`hidden md:flex items-center gap-2 px-3 py-1 rounded-full border text-xs transition ${
              isLiveGeminiMode
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-amber-300 hover:border-amber-500/50'
            }`}
            title={
              isLiveGeminiMode
                ? 'LIVE GEMINI MODE: Valid API key configured and live model calls enabled'
                : 'DEMO MODE: No API key configured. Deterministic local simulation is active (0 paid API calls).'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isLiveGeminiMode ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="font-mono font-bold text-[11px]">
              {isLiveGeminiMode ? 'LIVE GEMINI MODE' : 'DEMO MODE'}
            </span>
          </button>
        </div>

        {/* Center/Right Telemetry & Primary Actions */}
        <div className="flex items-center gap-2.5">
          {/* Active Workforce Count */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-mono font-bold text-white">
              {activeCount} active / {agents.length} employees
            </span>
          </div>

          {/* Global Token Consumption */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono font-bold text-amber-300">
              {(tokenUsage?.total_tokens_used || 0).toLocaleString()}
            </span>
            <span className="text-slate-500 font-mono text-[10px]">
              / {(tokenUsage?.global_token_budget || 100000).toLocaleString()}
            </span>
          </div>

          {/* Boardroom Split-View Quick Toggle */}
          <button
            onClick={() => {
              const nextOpen = !splitViewOpen;
              setSplitViewOpen(nextOpen);
              if (nextOpen && viewMode === 'DOLLHOUSE') {
                focusRoom('boardroom', 'ARCHITECTURAL');
              }
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
              isMeetingLive
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 animate-pulse'
                : splitViewOpen
                ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Boardroom</span>
          </button>

          {/* Primary Submit Project / Factory CTA */}
          <button
            onClick={() => setFactoryModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition"
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>

          {/* Optional Ambient Audio Mute/Unmute Toggle */}
          <button
            onClick={() => setAudioMuted(!audioMuted)}
            className={`p-2 rounded-xl border transition ${
              audioMuted
                ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
            }`}
            title={audioMuted ? 'Unmute Ambient Office Audio' : 'Mute Ambient Office Audio'}
          >
            {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Notification Indicator */}
          <div
            className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300"
            title={`${events.length} World Events Logged`}
          >
            <Bell className="w-4 h-4" />
            {events.length > 0 && (
              <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full bg-amber-500 text-slate-950 font-mono text-[9px] font-bold flex items-center justify-center">
                {events.length > 99 ? '99+' : events.length}
              </span>
            )}
          </div>

          {/* Settings Button */}
          <button
            onClick={() => setSettingsModalOpen(true)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
            title="LLM Gateway, AI Mode & Graphics Quality Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* LLM, AI Execution Mode & Performance Quality Settings Modal */}
      {settingsModalOpen && (
        <div
          onClick={() => setSettingsModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-[#101622] border border-slate-700/80 shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/70">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  AI Execution Mode & Graphics Performance Settings
                </h3>
              </div>
              <button
                onClick={() => setSettingsModalOpen(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="p-4 space-y-4 text-xs text-slate-200">
              {/* Explicit Provider Status Card */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase text-slate-400">
                    Current AI Execution Status
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                      isLiveGeminiMode
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {isLiveGeminiMode ? 'LIVE GEMINI MODE' : 'DEMO MODE'}
                  </span>
                </div>
                <div className="font-mono text-xs text-white leading-relaxed">
                  {tokenUsage?.provider_status ||
                    'DEMO MODE: No API key configured. Deterministic local simulation is active.'}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  Google Gemini API Key (Server-Side Only)
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value);
                    if (e.target.value.trim().length > 10) {
                      setEnableLiveToggle(true);
                    }
                  }}
                  placeholder="Enter GEMINI_API_KEY to enable Live Gemini Mode..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Leave blank to stay in deterministic Demo Mode with zero paid API requests.
                </p>
              </div>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900/70 border border-slate-800 cursor-pointer">
                <div>
                  <div className="text-xs font-bold text-white">
                    Explicitly Enable Live Gemini Execution
                  </div>
                  <div className="text-[10px] text-slate-400">
                    When disabled, agents execute using deterministic Demo Mode (0 API tokens billed).
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={enableLiveToggle}
                  onChange={(e) => setEnableLiveToggle(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
              </label>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  Primary Gemini Model ID (Tuned to Your Free Tier Quotas)
                </label>
                <select
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="gemini-3.1-flash-lite-preview">
                    gemini-3.1-flash-lite-preview — Recommended (15 RPM • 250K TPM • 500 RPD)
                  </option>
                  <option value="gemini-3.5-flash-lite">
                    gemini-3.5-flash-lite — High Quota Lite (15 RPM • 250K TPM • 500 RPD)
                  </option>
                  <option value="gemini-2.5-flash-lite">
                    gemini-2.5-flash-lite — Secondary Lite (10 RPM • 250K TPM • 20 RPD)
                  </option>
                  <option value="gemini-2.5-flash">
                    gemini-2.5-flash — Low Daily Quota (5 RPM • 250K TPM • 20 RPD)
                  </option>
                  <option value="gemini-3-flash-preview">
                    gemini-3-flash-preview — Low Daily Quota (5 RPM • 250K TPM • 20 RPD)
                  </option>
                </select>
                <p className="text-[10px] text-emerald-400/90 mt-1">
                  Strict sliding-window rate limiter active: paces requests automatically (4.2s spacing on 15 RPM tier) and disables 0-quota Pro/2.0 models.
                </p>
              </div>

              {/* 3D Graphics Quality & Developer Telemetry Section */}
              <div className="pt-2 border-t border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">
                    3D Rendering Quality Tier
                  </span>
                  <div className="flex items-center gap-1">
                    {(['AUTO', 'HIGH', 'MEDIUM', 'LOW'] as QualityPreset[]).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQualityPreset(q)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition ${
                          qualityPreset === q
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-sky-400" />
                    <span>Developer Performance Monitor (Ctrl+Shift+P)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setDevPerfOpen(!devPerfOpen)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold ${
                      devPerfOpen
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {devPerfOpen ? 'VISIBLE' : 'HIDDEN'}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettingsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  {savingSettings ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
