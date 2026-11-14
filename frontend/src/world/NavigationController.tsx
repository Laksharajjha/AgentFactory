import React from 'react';
import { Line } from '@react-three/drei';
import { useWorldStore } from '../state/worldStore';

export const NavigationController: React.FC = () => {
  const agents = useWorldStore((s) => s.agents);
  const isolatedFloor = useWorldStore((s) => s.isolatedFloor);

  const movingAgents = agents.filter(
    (a) => a.state === 'MOVING' && a.target_position && a.position
  );

  return (
    <group name="navigation-waypoints">
      {movingAgents.map((agent) => {
        if (!agent.target_position) return null;
        const start = agent.position;
        const end = agent.target_position;
        const mid: [number, number, number] = [
          (start[0] + end[0]) / 2,
          Math.max(start[1], end[1]) + 0.15,
          0,
        ];
        if (isolatedFloor !== null && Math.round(end[1] / 4.2) !== isolatedFloor) {
          return null;
        }
        return (
          <Line
            key={`nav-${agent.id}`}
            points={[
              [start[0], start[1] + 0.12, start[2]],
              mid,
              [end[0], end[1] + 0.12, end[2]],
            ]}
            color={agent.avatar_config?.accent_color || '#f59e0b'}
            lineWidth={2}
            dashed
            dashSize={0.35}
            gapSize={0.2}
          />
        );
      })}
    </group>
  );
};
