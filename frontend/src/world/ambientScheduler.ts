import { useEffect } from 'react';
import { useWorldStore, ROOM_LAYOUTS } from '../state/worldStore';
import { soundEngine } from '../utils/soundEngine';

const AMBIENT_BEHAVIORS: Array<{
  animation: 'Typing' | 'Thinking' | 'Reading' | 'Standing';
  suffix: string;
  offset: [number, number, number];
}> = [
  {
    animation: 'Typing',
    suffix: 'iterating on module implementation at workstation',
    offset: [0, 0, 0],
  },
  {
    animation: 'Reading',
    suffix: 'reviewing live telemetry & architecture wall display',
    offset: [-0.9, 0, -1.1],
  },
  {
    animation: 'Thinking',
    suffix: 'evaluating system edge cases & sprint dependencies',
    offset: [0.85, 0, -0.7],
  },
  {
    animation: 'Standing',
    suffix: 'checking espresso & hydration bar between sprints',
    offset: [1.3, 0, 0.4],
  },
];

export function useAmbientOffice() {
  const isPaused = useWorldStore((s) => s.isPaused);

  useEffect(() => {
    if (isPaused) return;

    // Seed initial subtle ambient activities after mount
    const runCycle = () => {
      const state = useWorldStore.getState();
      if (state.isPaused) return;

      const idleAgents = state.agents.filter((a) => a.state === 'IDLE');
      if (idleAgents.length === 0) return;

      // Pick 1 or 2 idle agents to transition to a new natural workplace activity
      const picked = idleAgents[Math.floor(Math.random() * idleAgents.length)];
      if (!picked) return;

      const homeRoom =
        ROOM_LAYOUTS.find((r) => r.id === picked.home_room_id) ||
        ROOM_LAYOUTS.find((r) => r.id === picked.current_room_id);
      if (!homeRoom) return;

      const behavior = AMBIENT_BEHAVIORS[Math.floor(Math.random() * AMBIENT_BEHAVIORS.length)];
      const [hx, hy, hz] = homeRoom.center;

      const targetPosition: [number, number, number] = [
        hx + behavior.offset[0],
        hy + behavior.offset[1],
        hz + behavior.offset[2],
      ];

      state.setAmbientOverride(picked.id, {
        animation: behavior.animation,
        activityText: `${picked.name} ${behavior.suffix}`,
        targetPosition,
      });

      if (behavior.animation === 'Typing') {
        soundEngine.playKeyClick();
      }
    };

    const timer = window.setInterval(runCycle, 4500);
    return () => window.clearInterval(timer);
  }, [isPaused]);
}
