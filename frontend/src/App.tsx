import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
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
import { ExpandedScreenModal } from './world/ExpandedScreenModal';
import { WorldScene } from './world/WorldScene';
import { useAmbientOffice } from './world/ambientScheduler';

export const App: React.FC = () => {
  useWorldEvents();
  useAmbientOffice();

  const errorBanner = useEventStore((s) => s.errorBanner);
  const setErrorBanner = useEventStore((s) => s.setErrorBanner);
  const { expandedPresentation, setExpandedPresentation } = useMeeting();

  return (
    <div className="flex flex-col w-screen h-screen bg-[#0b0e14] text-slate-100 overflow-hidden">
      <TopBar />

      {errorBanner && (
        <div className="bg-red-950/90 border-b border-red-800 px-4 py-1.5 text-xs text-red-200 flex items-center justify-between z-40">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            onClick={() => setErrorBanner(null)}
            className="p-0.5 rounded hover:bg-red-900 text-red-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        <LeftSidebar />

        <main className="flex-1 relative min-w-0 h-full">
          <WorldScene />
          <MeetingRoom />
        </main>

        <RightInspector />
      </div>

      <BottomControlBar />

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
