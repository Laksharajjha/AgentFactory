import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { AuthModal } from './components/enterprise/AuthModal';
import { CommandPalette } from './components/enterprise/CommandPalette';
import { OfficeActivityStrip } from './components/enterprise/OfficeActivityStrip';
import { PlatformWorkspaceViews } from './components/enterprise/PlatformWorkspaceViews';
import { BottomControlBar } from './components/layout/BottomControlBar';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { RightInspector } from './components/layout/RightInspector';
import { TopBar } from './components/layout/TopBar';
import { FactoryPanel } from './factory/FactoryPanel';
import { useMeeting } from './hooks/useMeeting';
import { useWorldEvents } from './hooks/useWorldEvents';
import { MeetingRoom } from './meetings/MeetingRoom';
import { PresentationViewer } from './meetings/PresentationViewer';
import { useEventStore } from './state/eventStore';
import { useWorldStore } from './state/worldStore';
import { ExpandedScreenModal } from './world/ExpandedScreenModal';
import { WorldScene } from './world/WorldScene';
import { useAmbientOffice } from './world/ambientScheduler';

export const App: React.FC = () => {
  useWorldEvents();
  useAmbientOffice();

  const errorBanner = useEventStore((s) => s.errorBanner);
  const setErrorBanner = useEventStore((s) => s.setErrorBanner);
  const activeAppSection = useWorldStore((s) => s.activeAppSection);
  const setActiveAppSection = useWorldStore((s) => s.setActiveAppSection);
  const authToken = useWorldStore((s) => s.authToken);
  const activeWorkspace = useWorldStore((s) => s.activeWorkspace);
  const completeGitHubOAuth = useWorldStore((s) => s.completeGitHubOAuth);
  const setGitHubError = useWorldStore((s) => s.setGitHubError);
  const { expandedPresentation, setExpandedPresentation } = useMeeting();

  const pendingOAuthRef = useRef<{
    code?: string;
    state?: string;
    installationId?: string | null;
    error?: string;
    errorDescription?: string;
  } | null>(null);
  const oauthHandledRef = useRef(false);

  // Capture GitHub OAuth callback query params once and strip them from URL immediately
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const installationId = params.get('installation_id');
    const oauthError = params.get('error');
    const oauthErrorDesc = params.get('error_description');

    if (oauthError) {
      pendingOAuthRef.current = {
        error: oauthError,
        errorDescription: oauthErrorDesc || undefined,
      };
      setActiveAppSection('github');
      window.history.replaceState({}, '', '/');
      return;
    }

    if (code && state) {
      pendingOAuthRef.current = { code, state, installationId };
      setActiveAppSection('github');
      window.history.replaceState({}, '', '/');
    }
  }, [setActiveAppSection]);

  // Complete GitHub OAuth exchange once authToken and activeWorkspace are hydrated
  useEffect(() => {
    const pending = pendingOAuthRef.current;
    if (!pending || oauthHandledRef.current) return;

    if (pending.error) {
      oauthHandledRef.current = true;
      const msg =
        pending.error === 'access_denied'
          ? 'GitHub authorization was cancelled. Click Connect GitHub whenever you are ready to try again.'
          : pending.errorDescription || `GitHub authorization failed (${pending.error}).`;
      setGitHubError(msg);
      return;
    }

    if (pending.code && pending.state && authToken && activeWorkspace?.id) {
      oauthHandledRef.current = true;
      void completeGitHubOAuth(pending.code, pending.state, pending.installationId);
    }
  }, [authToken, activeWorkspace?.id, completeGitHubOAuth, setGitHubError]);

  return (
    <div className="flex flex-col w-screen h-screen bg-[#101216] text-[#E8EBF0] overflow-hidden">
      <TopBar />

      {/* Compact Real-Time Office Activity Strip (visible in 3D Office view) */}
      {activeAppSection === 'office' && <OfficeActivityStrip />}

      {errorBanner && (
        <div className="bg-[#C45D62]/20 border-b border-[#C45D62]/60 px-4 py-1.5 text-xs text-[#E8EBF0] flex items-center justify-between z-40">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#C45D62] shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            onClick={() => setErrorBanner(null)}
            className="p-0.5 rounded hover:bg-[#C45D62]/30 text-[#E8EBF0]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        <LeftSidebar />

        <main className="flex-1 relative min-w-0 h-full overflow-hidden">
          {activeAppSection === 'office' ? (
            <>
              <WorldScene />
              <MeetingRoom />
            </>
          ) : (
            <PlatformWorkspaceViews />
          )}
        </main>

        <RightInspector />
      </div>

      <BottomControlBar />

      {/* Enterprise Command Palette (Cmd+K / Ctrl+K) */}
      <CommandPalette />

      {/* Enterprise Authentication & Workspace Modal */}
      <AuthModal />

      {/* Workforce Factory Modal */}
      <FactoryPanel isModal />

      {/* Interactive Workstation / Room Screen Modal */}
      <ExpandedScreenModal />

      {/* Full-Screen Presentation Viewer Modal */}
      {expandedPresentation && (
        <PresentationViewer
          presentation={expandedPresentation}
          isModal
          onClose={() => setExpandedPresentation(null)}
        />
      )}
    </div>
  );
};

export default App;
