import { create } from 'zustand';
import { WorldEvent } from '../types/event';

interface EventStoreState {
  events: WorldEvent[];
  lastSequence: number;
  wsConnected: boolean;
  errorBanner: string | null;
  setEvents: (events: WorldEvent[]) => void;
  addEvent: (event: WorldEvent) => void;
  setWsConnected: (connected: boolean) => void;
  setErrorBanner: (msg: string | null) => void;
}

export const useEventStore = create<EventStoreState>((set) => ({
  events: [],
  lastSequence: 0,
  wsConnected: false,
  errorBanner: null,
  setEvents: (events) =>
    set({
      events,
      lastSequence: events.length > 0 ? Math.max(...events.map((e) => e.sequence)) : 0,
    }),
  addEvent: (event) =>
    set((state) => {
      if (state.events.some((e) => e.event_id === event.event_id)) {
        return state;
      }
      const next = [...state.events, event].slice(-120);
      return {
        events: next,
        lastSequence: Math.max(state.lastSequence, event.sequence),
      };
    }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setErrorBanner: (errorBanner) => set({ errorBanner }),
}));
