import React from 'react';
import { SHARED_MATERIALS } from './sharedMaterials';

interface GlassPartitionProps {
  position: [number, number, number];
  args: [number, number, number];
}

export const GlassPartition: React.FC<GlassPartitionProps> = React.memo(({ position, args }) => {
  const [w, h, d] = args;
  return (
    <group position={position}>
      {/* Lightweight architectural glass pane (zero FBO transmission overhead) */}
      <mesh material={SHARED_MATERIALS.glassPartition}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {/* Brushed dark steel top & bottom mullions */}
      <mesh position={[0, h / 2 - 0.03, 0]} material={SHARED_MATERIALS.darkSteel}>
        <boxGeometry args={[w + 0.02, 0.06, d + 0.03]} />
      </mesh>
      <mesh position={[0, -h / 2 + 0.03, 0]} material={SHARED_MATERIALS.darkSteel}>
        <boxGeometry args={[w + 0.02, 0.06, d + 0.03]} />
      </mesh>
    </group>
  );
});
