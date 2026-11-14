import React from 'react';
import { SHARED_MATERIALS } from './sharedMaterials';

interface WindowProps {
  position: [number, number, number];
  args: [number, number, number];
}

export const Window: React.FC<WindowProps> = React.memo(({ position, args }) => {
  const [w, h, d] = args;
  return (
    <group position={position}>
      {/* Floor-to-ceiling low-iron daylight architectural glass */}
      <mesh material={SHARED_MATERIALS.windowGlass}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {/* Brushed charcoal architectural mullions */}
      <mesh position={[0, h / 2, 0]} material={SHARED_MATERIALS.brushedSteel}>
        <boxGeometry args={[w, 0.07, d + 0.04]} />
      </mesh>
      <mesh position={[0, -h / 2, 0]} material={SHARED_MATERIALS.brushedSteel}>
        <boxGeometry args={[w, 0.07, d + 0.04]} />
      </mesh>
    </group>
  );
});
