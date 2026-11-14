import React from 'react';
import { SHARED_MATERIALS } from './sharedMaterials';

interface PlantProps {
  position: [number, number, number];
  scale?: number;
}

export const Plant: React.FC<PlantProps> = React.memo(({ position, scale = 1 }) => {
  return (
    <group position={position} scale={[scale, scale, scale]}>
      {/* Warm ceramic planter pot (no real-time shadow casting on small decor) */}
      <mesh position={[0, 0.22, 0]} material={SHARED_MATERIALS.ceramicPlanter}>
        <cylinderGeometry args={[0.22, 0.17, 0.44, 10]} />
      </mesh>
      {/* Soil rim */}
      <mesh position={[0, 0.43, 0]} material={SHARED_MATERIALS.plantSoil}>
        <cylinderGeometry args={[0.2, 0.2, 0.03, 10]} />
      </mesh>
      {/* Lush indoor Ficus / Monstera foliage clusters */}
      <mesh position={[0, 0.72, 0]} material={SHARED_MATERIALS.foliageDark}>
        <dodecahedronGeometry args={[0.28, 1]} />
      </mesh>
      <mesh position={[0.14, 0.92, 0.08]} material={SHARED_MATERIALS.foliageMid}>
        <dodecahedronGeometry args={[0.22, 1]} />
      </mesh>
      <mesh position={[-0.12, 0.98, -0.06]} material={SHARED_MATERIALS.foliageBright}>
        <dodecahedronGeometry args={[0.2, 1]} />
      </mesh>
    </group>
  );
});
