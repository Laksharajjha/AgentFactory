import { create } from 'zustand';
import { MeetingPresentation } from '../types/meeting';

interface MeetingStoreState {
  splitViewOpen: boolean;
  observationPaused: boolean;
  expandedPresentation: MeetingPresentation | null;
  selectedMeetingId: string | null;
  setSplitViewOpen: (open: boolean) => void;
  setObservationPaused: (paused: boolean) => void;
  setExpandedPresentation: (pres: MeetingPresentation | null) => void;
  setSelectedMeetingId: (id: string | null) => void;
}

export const useMeetingStore = create<MeetingStoreState>((set) => ({
  splitViewOpen: false,
  observationPaused: false,
  expandedPresentation: null,
  selectedMeetingId: null,
  setSplitViewOpen: (splitViewOpen) => set({ splitViewOpen }),
  setObservationPaused: (observationPaused) => set({ observationPaused }),
  setExpandedPresentation: (expandedPresentation) => set({ expandedPresentation }),
  setSelectedMeetingId: (selectedMeetingId) => set({ selectedMeetingId }),
}));
