import React, { useState } from 'react';
import {
  Activity,
  Bell,
  Boxes,
  Building2,
  Command,
  Cpu,
  Footprints,
  KeyRound,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Rocket,
  Search,
  Settings,
  Sun,
  UserCheck,
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

  // FORGE 3.0 Enterprise Shell State
  const currentUser = useWorldStore((s) => s.currentUser);
  const currentWorkspace = useWorldStore((s) => s.activeWorkspace);
  const setCommandPaletteOpen = useWorldStore((s) => s.setCommandPaletteOpen);
  const setAuthModalOpen = useWorldStore((s) => s.setAuthModalOpen);
  const activeAppSection = useWorldStore((s) => s.activeAppSection);
  const setActiveAppSection = useWorldStore((s) => s.setActiveAppSection);
  const leftNavCollapsed = useWorldStore((s) => s.leftNavCollapsed);
  const setLeftNavCollapsed = useWorldStore((s) => s.setLeftNavCollapsed);
  const rightInspectorCollapsed = useWorldStore((s) => s.rightInspectorCollapsed);
  const setRightInspectorCollapsed = useWorldStore((s) => s.setRightInspectorCollapsed);

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
      <header className="h-12 px-3 bg-[#101216] border-b border-[#343A45]/80 flex items-center justify-between select-none z-30 shrink-0 text-[#E8EBF0]">
        {/* Left: PROJECT FORGE 3.0 Brand, Workspace Selector & Mode Switch */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setLeftNavCollapsed(!leftNavCollapsed)}
            className="p-1.5 rounded-md bg-[#151920] hover:bg-[#1B2028] border border-[#343A45] text-[#A5ACB8] hover:text-[#E8EBF0] transition"
            title={leftNavCollapsed ? 'Expand Left Drawer' : 'Collapse Left Drawer'}
          >
            {leftNavCollapsed ? (
              <PanelLeftOpen className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftClose className="w-3.5 h-3.5" />
            )}
          </button>

          <div
            onClick={() => setActiveAppSection('office')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-7 h-7 rounded-md bg-[#4778D0] flex items-center justify-center shadow-sm">
              <Boxes className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-wide text-[#E8EBF0]">
                  PROJECT FORGE
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#4778D0]/20 text-[#4778D0] border border-[#4778D0]/40">
                  3.0 PLATFORM
                </span>
              </div>
              <div className="text-[10px] text-[#737D8C] truncate max-w-[160px]">
                {currentWorkspace?.name || workforceName}
              </div>
            </div>
          </div>

          <div className="h-5 w-px bg-[#343A45] hidden sm:block" />

          {/* Prominent DOLLHOUSE | WALK AROUND Switcher */}
          <div className="flex items-center bg-[#151920] p-0.5 rounded-md border border-[#343A45]">
            <button
              onClick={() => {
                setActiveAppSection('office');
                setViewMode('DOLLHOUSE');
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition ${
                activeAppSection === 'office' && viewMode === 'DOLLHOUSE'
                  ? 'bg-[#4778D0] text-white'
                  : 'text-[#A5ACB8] hover:text-[#E8EBF0]'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>DOLLHOUSE</span>
            </button>
            <button
              onClick={() => {
                setActiveAppSection('office');
                setViewMode('WALK');
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition ${
                activeAppSection === 'office' && viewMode === 'WALK'
                  ? 'bg-[#299B83] text-white'
                  : 'text-[#A5ACB8] hover:text-[#E8EBF0]'
              }`}
            >
              <Footprints className="w-3.5 h-3.5" />
              <span>WALK AROUND</span>
            </button>
          </div>

          {/* Command Palette Trigger (Cmd+K / Ctrl+K) */}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#151920] hover:bg-[#1B2028] border border-[#343A45] text-xs text-[#A5ACB8] hover:text-[#E8EBF0] transition"
            title="Open Command Palette (Cmd+K / Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-[#737D8C]" />
            <span className="text-[11px]">Jump or run command...</span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#101216] border border-[#343A45] text-[#737D8C] flex items-center gap-0.5">
              <Command className="w-2.5 h-2.5" />K
            </kbd>
          </button>

          {/* Daylight Preset Button */}
          <button
            onClick={cycleDaylightPreset}
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#151920] hover:bg-[#1B2028] border border-[#343A45] text-xs text-[#A5ACB8] transition"
            title="Cycle Natural Daylight Preset (Morning / Daytime / Afternoon)"
          >
            <Sun className="w-3.5 h-3.5 text-[#D29A43]" />
            <span className="font-mono text-[10px]">{daylightPreset}</span>
          </button>

          {/* Explicit AI Provider Status Badge (DEMO MODE vs LIVE GEMINI MODE) */}
          <button
            onClick={() => setSettingsModalOpen(true)}
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] transition ${
              isLiveGeminiMode
                ? 'bg-[#299B83]/15 border-[#299B83]/50 text-[#299B83]'
                : 'bg-[#151920] border-[#343A45] text-[#D29A43] hover:border-[#D29A43]/60'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isLiveGeminiMode ? 'bg-[#299B83] animate-pulse' : 'bg-[#D29A43]'
              }`}
            />
            <span className="font-mono font-semibold text-[10px]">
              {isLiveGeminiMode ? 'LIVE GEMINI' : 'DEMO MODE'}
            </span>
          </button>
        </div>

        {/* Right Telemetry, Workspace User & Primary Actions */}
        <div className="flex items-center gap-2">
          {/* Active Workforce Count */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#151920] border border-[#343A45] text-[11px]">
            <Users className="w-3.5 h-3.5 text-[#4778D0]" />
            <span className="font-mono font-semibold text-[#E8EBF0]">
              {activeCount}/{agents.length} active
            </span>
          </div>

          {/* Global Token Consumption */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#151920] border border-[#343A45] text-[11px]">
            <Cpu className="w-3.5 h-3.5 text-[#D29A43]" />
            <span className="font-mono font-semibold text-[#E8EBF0]">
              {(tokenUsage?.total_tokens_used || 0).toLocaleString()}
            </span>
            <span className="text-[#737D8C] font-mono text-[10px]">
              / {(tokenUsage?.global_token_budget || 100000).toLocaleString()}
            </span>
          </div>

          {/* Boardroom Split-View Quick Toggle */}
          <button
            onClick={() => {
              setActiveAppSection('office');
              const nextOpen = !splitViewOpen;
              setSplitViewOpen(nextOpen);
              if (nextOpen && viewMode === 'DOLLHOUSE') {
                focusRoom('boardroom', 'ARCHITECTURAL');
              }
            }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 border transition ${
              isMeetingLive
                ? 'bg-[#299B83]/20 border-[#299B83]/50 text-[#299B83] animate-pulse'
                : splitViewOpen
                ? 'bg-[#4778D0]/20 border-[#4778D0]/50 text-[#4778D0]'
                : 'bg-[#151920] border-[#343A45] text-[#A5ACB8] hover:text-[#E8EBF0]'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Boardroom</span>
          </button>

          {/* Primary Submit Project / Factory CTA */}
          <button
            onClick={() => setFactoryModalOpen(true)}
            className="px-3 py-1 rounded-md bg-[#4778D0] hover:bg-[#3b66b5] text-white font-semibold text-[11px] flex items-center gap-1.5 transition"
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>

          {/* Authenticated User & Workspace Badge */}
          <button
            onClick={() => setAuthModalOpen(true)}
            className="px-2.5 py-1 rounded-md bg-[#151920] hover:bg-[#1B2028] border border-[#343A45] text-[11px] text-[#E8EBF0] flex items-center gap-1.5 transition"
            title="Workspace & Identity Management"
          >
            <UserCheck className="w-3.5 h-3.5 text-[#299B83]" />
            <span className="hidden md:inline font-medium max-w-[110px] truncate">
              {currentUser?.name || 'Sign In'}
            </span>
          </button>

          {/* Ambient Audio Toggle */}
          <button
            onClick={() => setAudioMuted(!audioMuted)}
            className={`p-1.5 rounded-md border transition ${
              audioMuted
                ? 'bg-[#151920] border-[#343A45] text-[#737D8C] hover:text-[#E8EBF0]'
                : 'bg-[#299B83]/15 border-[#299B83]/40 text-[#299B83]'
            }`}
            title={audioMuted ? 'Unmute Ambient Office Audio' : 'Mute Ambient Office Audio'}
          >
            {audioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Notification Indicator */}
          <div
            className="relative p-1.5 rounded-md bg-[#151920] border border-[#343A45] text-[#A5ACB8]"
            title={`${events.length} World Events Logged`}
          >
            <Bell className="w-3.5 h-3.5" />
            {events.length > 0 && (
              <span className="absolute -top-1 -right-1 px-1 min-w-[14px] h-3.5 rounded-full bg-[#4778D0] text-white font-mono text-[8px] font-bold flex items-center justify-center">
                {events.length > 99 ? '99+' : events.length}
              </span>
            )}
          </div>

          {/* Settings Button */}
          <button
            onClick={() => setSettingsModalOpen(true)}
            className="p-1.5 rounded-md bg-[#151920] hover:bg-[#1B2028] border border-[#343A45] text-[#A5ACB8] hover:text-[#E8EBF0] transition"
            title="LLM Gateway, AI Mode & Graphics Quality Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Right Inspector Collapse Toggle */}
          <button
            onClick={() => setRightInspectorCollapsed(!rightInspectorCollapsed)}
            className="p-1.5 rounded-md bg-[#151920] hover:bg-[#1B2028] border border-[#343A45] text-[#A5ACB8] hover:text-[#E8EBF0] transition"
            title={rightInspectorCollapsed ? 'Expand Right Inspector' : 'Collapse Right Inspector'}
          >
            {rightInspectorCollapsed ? (
              <PanelRightOpen className="w-3.5 h-3.5" />
            ) : (
              <PanelRightClose className="w-3.5 h-3.5" />
            )}
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
            className="w-full max-w-lg rounded-md bg-[#151920] border border-[#343A45] shadow-2xl overflow-hidden text-[#E8EBF0]"
          >
            <div className="p-3.5 border-b border-[#343A45] flex items-center justify-between bg-[#101216]">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#4778D0]" />
                <h3 className="text-sm font-semibold text-[#E8EBF0]">
                  AI Execution Mode & Graphics Performance Settings
                </h3>
              </div>
              <button
                onClick={() => setSettingsModalOpen(false)}
                className="p-1 rounded-md bg-[#1B2028] text-[#A5ACB8] hover:text-[#E8EBF0]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="p-4 space-y-4 text-xs">
              <div className="p-3 rounded-md bg-[#101216] border border-[#343A45] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase text-[#A5ACB8]">
                    Current AI Execution Status
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                      isLiveGeminiMode
                        ? 'bg-[#299B83]/20 text-[#299B83]'
                        : 'bg-[#D29A43]/20 text-[#D29A43]'
                    }`}
                  >
                    {isLiveGeminiMode ? 'LIVE GEMINI MODE' : 'DEMO MODE'}
                  </span>
                </div>
                <div className="font-mono text-xs text-[#E8EBF0] leading-relaxed">
                  {tokenUsage?.provider_status ||
                    'DEMO MODE: No API key configured. Deterministic local simulation is active.'}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#A5ACB8] uppercase mb-1">
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
                  className="w-full bg-[#101216] border border-[#343A45] rounded-md px-3 py-2 text-xs text-[#E8EBF0] focus:outline-none focus:border-[#4778D0]"
                />
                <p className="text-[10px] text-[#737D8C] mt-1">
                  Leave blank to stay in deterministic Demo Mode with zero paid API requests.
                </p>
              </div>

              <label className="flex items-center justify-between p-3 rounded-md bg-[#101216] border border-[#343A45] cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-[#E8EBF0]">
                    Explicitly Enable Live Gemini Execution
                  </div>
                  <div className="text-[10px] text-[#A5ACB8]">
                    When disabled, agents execute using deterministic Demo Mode (0 API tokens billed).
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={enableLiveToggle}
                  onChange={(e) => setEnableLiveToggle(e.target.checked)}
                  className="w-4 h-4 accent-[#4778D0]"
                />
              </label>

              <div>
                <label className="block text-[11px] font-semibold text-[#A5ACB8] uppercase mb-1">
                  Primary Gemini Model ID (Tuned to Your Free Tier Quotas)
                </label>
                <select
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  className="w-full bg-[#101216] border border-[#343A45] rounded-md px-3 py-2 text-xs text-[#E8EBF0] focus:outline-none focus:border-[#4778D0]"
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
                <p className="text-[10px] text-[#299B83] mt-1">
                  Strict sliding-window rate limiter active: paces requests automatically (4.2s spacing on 15 RPM tier) and disables 0-quota Pro/2.0 models.
                </p>
              </div>

              <div className="pt-2 border-t border-[#343A45] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#A5ACB8] uppercase">
                    3D Rendering Quality Tier
                  </span>
                  <div className="flex items-center gap-1">
                    {(['AUTO', 'HIGH', 'MEDIUM', 'LOW'] as QualityPreset[]).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQualityPreset(q)}
                        className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold transition ${
                          qualityPreset === q
                            ? 'bg-[#4778D0] text-white'
                            : 'bg-[#101216] text-[#A5ACB8] border border-[#343A45] hover:bg-[#1B2028]'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-[#A5ACB8] flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#4778D0]" />
                    <span>Developer Performance Monitor (Ctrl+Shift+P)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setDevPerfOpen(!devPerfOpen)}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold ${
                      devPerfOpen
                        ? 'bg-[#4778D0] text-white'
                        : 'bg-[#101216] text-[#A5ACB8] border border-[#343A45] hover:bg-[#1B2028]'
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
                  className="px-3 py-1.5 rounded-md bg-[#1B2028] text-[#A5ACB8] hover:text-[#E8EBF0]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-4 py-1.5 rounded-md bg-[#4778D0] hover:bg-[#3b66b5] text-white font-semibold"
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
