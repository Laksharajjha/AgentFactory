import React, { useEffect, useState } from 'react';
import {
  Activity,
  Bell,
  Boxes,
  Building2,
  CheckCircle2,
  Command,
  Cpu,
  Footprints,
  KeyRound,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  ShieldAlert,
  Sun,
  Trash2,
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
    tokenUsage?.active_model || 'gemini-3.1-flash-lite'
  );
  const [enableLiveToggle, setEnableLiveToggle] = useState(isLiveGeminiMode);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingSettings, setTestingSettings] = useState(false);
  const [deletingSettings, setDeletingSettings] = useState(false);
  const [credentialConfigured, setCredentialConfigured] = useState(false);
  const [credentialStatusText, setCredentialStatusText] = useState('Not Configured');
  const [credentialVersion, setCredentialVersion] = useState(0);
  const [validationStatus, setValidationStatus] = useState('UNCONFIGURED');
  const [lastValidatedAt, setLastValidatedAt] = useState<string | null>(null);
  const [settingsFeedback, setSettingsFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const loadWorkspaceLlmStatus = async () => {
    try {
      const token = useWorldStore.getState().authToken;
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/api/settings/llm`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setCredentialConfigured(Boolean(data.configured));
      setCredentialStatusText(data.masked_status || data.credential_status || (data.configured ? 'Configured (Encrypted)' : 'Not Configured'));
      setCredentialVersion(Number(data.credential_version || 0));
      setValidationStatus(String(data.validation_status || 'UNCONFIGURED'));
      setLastValidatedAt(data.last_validated_at || null);
      if (data.selected_model) {
        setModelInput(data.selected_model);
      }
      if (typeof data.enable_live_execution === 'boolean') {
        setEnableLiveToggle(data.enable_live_execution);
      }
    } catch {
      // Non-fatal status fetch failure
    }
  };

  useEffect(() => {
    if (settingsModalOpen) {
      setSettingsFeedback(null);
      setApiKeyInput('');
      void loadWorkspaceLlmStatus();
    }
  }, [settingsModalOpen]);

  const handleTestCredential = async () => {
    setTestingSettings(true);
    setSettingsFeedback(null);
    try {
      const token = useWorldStore.getState().authToken;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE_URL}/api/settings/llm/test`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          provider: 'gemini',
          gemini_api_key: apiKeyInput.trim() ? apiKeyInput.trim() : undefined,
          gemini_model: modelInput,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.valid === false) {
        const msg = data.detail || data.message || `Credential test failed (${res.status})`;
        setSettingsFeedback({ type: 'error', message: String(msg) });
        return;
      }
      setValidationStatus(String(data.validation_status || 'VALID'));
      setLastValidatedAt(data.last_validated_at || data.validated_at || new Date().toISOString());
      setSettingsFeedback({
        type: 'success',
        message: `${data.detail || data.message || 'Workspace Gemini credential validated.'} (${data.latency_ms ?? 0} ms)`,
      });
    } catch (err) {
      setSettingsFeedback({ type: 'error', message: `Connection test failed: ${String(err)}` });
    } finally {
      setTestingSettings(false);
    }
  };

  const handleDeleteCredential = async () => {
    setDeletingSettings(true);
    setSettingsFeedback(null);
    try {
      const token = useWorldStore.getState().authToken;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE_URL}/api/settings/llm`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSettingsFeedback({
          type: 'error',
          message: String(data.detail || `Failed to delete credential (${res.status})`),
        });
        return;
      }
      setCredentialConfigured(false);
      setCredentialStatusText('Not Configured');
      setCredentialVersion(0);
      setValidationStatus('UNCONFIGURED');
      setLastValidatedAt(null);
      setEnableLiveToggle(false);
      setApiKeyInput('');
      setSettingsFeedback({
        type: 'success',
        message: 'Workspace Gemini API key deleted and provider cache invalidated.',
      });
      await fetchSnapshot();
    } catch (err) {
      setSettingsFeedback({ type: 'error', message: `Delete failed: ${String(err)}` });
    } finally {
      setDeletingSettings(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsFeedback(null);
    try {
      const token = useWorldStore.getState().authToken;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const endpoint =
        credentialConfigured && apiKeyInput.trim().length > 0
          ? `${API_BASE_URL}/api/settings/llm/rotate`
          : `${API_BASE_URL}/api/settings/llm`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          provider: 'gemini',
          gemini_api_key: apiKeyInput.trim() ? apiKeyInput.trim() : undefined,
          gemini_model: modelInput,
          enable_live_execution: enableLiveToggle,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSettingsFeedback({
          type: 'error',
          message: String(data.detail || `Failed to save AI configuration (${res.status})`),
        });
        return;
      }
      setApiKeyInput('');
      await loadWorkspaceLlmStatus();
      await fetchSnapshot();
      setSettingsFeedback({
        type: 'success',
        message: 'Workspace AI configuration encrypted and saved.',
      });
    } catch (err) {
      setSettingsFeedback({
        type: 'error',
        message: `Save failed: ${String(err)}`,
      });
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
              <div className="p-3 rounded-md bg-[#101216] border border-[#343A45] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase text-[#A5ACB8]">
                    Workspace BYOK Status ({currentWorkspace?.name || 'Active Workspace'})
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
                <div className="pt-1.5 border-t border-[#343A45]/60 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
                  <span className="text-[#A5ACB8]">
                    Credential:{' '}
                    <strong className={credentialConfigured ? 'text-[#299B83]' : 'text-[#D29A43]'}>
                      {credentialStatusText}
                    </strong>
                    {credentialVersion > 0 ? ` (v${credentialVersion})` : ''}
                  </span>
                  <span className="text-[#A5ACB8]">
                    Validation:{' '}
                    <strong
                      className={
                        validationStatus.startsWith('VALID')
                          ? 'text-[#299B83]'
                          : validationStatus === 'INVALID'
                          ? 'text-[#E05252]'
                          : 'text-[#D29A43]'
                      }
                    >
                      {validationStatus}
                    </strong>
                    {lastValidatedAt ? ` • ${new Date(lastValidatedAt).toLocaleTimeString()}` : ''}
                  </span>
                </div>
              </div>

              {settingsFeedback && (
                <div
                  className={`p-2.5 rounded-md border flex items-center gap-2 text-xs ${
                    settingsFeedback.type === 'success'
                      ? 'bg-[#299B83]/15 border-[#299B83]/50 text-[#299B83]'
                      : 'bg-[#E05252]/15 border-[#E05252]/50 text-[#E05252]'
                  }`}
                >
                  {settingsFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                  )}
                  <span>{settingsFeedback.message}</span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-[#A5ACB8] uppercase">
                    Google Gemini API Key (Fernet-Encrypted Workspace Vault)
                  </label>
                  <span className="text-[10px] font-mono text-[#4778D0]">Provider: gemini</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    autoComplete="off"
                    value={apiKeyInput}
                    onChange={(e) => {
                      setApiKeyInput(e.target.value);
                      if (e.target.value.trim().length > 10) {
                        setEnableLiveToggle(true);
                      }
                    }}
                    placeholder={
                      credentialConfigured
                        ? 'Enter new GEMINI_API_KEY to rotate existing workspace key...'
                        : 'Enter GEMINI_API_KEY to enable Live Gemini Mode...'
                    }
                    className="flex-1 bg-[#101216] border border-[#343A45] rounded-md px-3 py-2 text-xs text-[#E8EBF0] focus:outline-none focus:border-[#4778D0]"
                  />
                  <button
                    type="button"
                    disabled={testingSettings || (!apiKeyInput.trim() && !credentialConfigured)}
                    onClick={handleTestCredential}
                    className="px-2.5 py-2 rounded-md bg-[#1B2028] hover:bg-[#252C37] disabled:opacity-40 border border-[#343A45] text-[#E8EBF0] font-semibold text-[11px] flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingSettings ? 'animate-spin' : ''}`} />
                    <span>{testingSettings ? 'Testing...' : 'Test Key'}</span>
                  </button>
                  {credentialConfigured && (
                    <button
                      type="button"
                      disabled={deletingSettings}
                      onClick={handleDeleteCredential}
                      title="Delete Workspace API Key"
                      className="px-2.5 py-2 rounded-md bg-[#E05252]/15 hover:bg-[#E05252]/25 border border-[#E05252]/40 text-[#E05252] font-semibold text-[11px] flex items-center gap-1 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{deletingSettings ? '...' : 'Delete'}</span>
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-[#737D8C] mt-1">
                  Encrypted at rest via Fernet and isolated strictly to this workspace. Never stored in browser storage or returned in API responses.
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
                  Workspace Primary Gemini Model ID
                </label>
                <select
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  className="w-full bg-[#101216] border border-[#343A45] rounded-md px-3 py-2 text-xs text-[#E8EBF0] focus:outline-none focus:border-[#4778D0]"
                >
                  <option value="gemini-3.1-flash-lite">
                    gemini-3.1-flash-lite — Recommended Default (15 RPM • 250K TPM • 500 RPD)
                  </option>
                  <option value="gemini-3.1-flash-lite-preview">
                    gemini-3.1-flash-lite-preview — Preview Lite (15 RPM • 250K TPM • 500 RPD)
                  </option>
                  <option value="gemini-3.5-flash-lite">
                    gemini-3.5-flash-lite — High Quota Lite (15 RPM • 250K TPM • 500 RPD)
                  </option>
                  <option value="gemini-2.5-flash-lite">
                    gemini-2.5-flash-lite — Secondary Lite (10 RPM • 250K TPM • 20 RPD)
                  </option>
                  <option value="gemini-2.5-flash">
                    gemini-2.5-flash — Standard Flash (5 RPM • 250K TPM • 20 RPD)
                  </option>
                  <option value="gemini-3-flash-preview">
                    gemini-3-flash-preview — Preview Flash (5 RPM • 250K TPM • 20 RPD)
                  </option>
                </select>
                <p className="text-[10px] text-[#299B83] mt-1">
                  Per-workspace sliding-window rate limiter paces requests automatically and blocks 0-quota models.
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
                  {savingSettings
                    ? 'Saving...'
                    : credentialConfigured && apiKeyInput.trim().length > 0
                    ? 'Rotate & Save Key'
                    : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
