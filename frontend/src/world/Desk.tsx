import React from 'react';
import { Monitor } from './Monitor';
import { OfficeChair } from './OfficeChair';
import { SHARED_GEOMETRIES, SHARED_MATERIALS } from './sharedMaterials';

interface DeskProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  executive?: boolean;
  screenColor?: string;
  roomId?: string;
}

export const Desk = React.memo<DeskProps>(({
  position,
  rotation = [0, 0, 0],
  executive = false,
  screenColor = '#0284c7',
  roomId = 'backend_room',
}) => {
  const width = executive ? 2.25 : 1.85;
  const depth = executive ? 0.96 : 0.84;

  return (
    <group position={position} rotation={rotation}>
      {/* Warm natural wood tabletop */}
      <mesh
        position={[0, 0.74, 0]}
        receiveShadow
        material={executive ? SHARED_MATERIALS.executiveWalnut : SHARED_MATERIALS.warmOak}
      >
        <boxGeometry args={[width, 0.055, depth]} />
      </mesh>

      {/* Architectural powder-coated steel frame legs */}
      <mesh
        position={[-width / 2 + 0.08, 0.36, 0]}
        material={SHARED_MATERIALS.brushedSteel}
      >
        <boxGeometry args={[0.06, 0.72, depth - 0.1]} />
      </mesh>
      <mesh
        position={[width / 2 - 0.08, 0.36, 0]}
        material={SHARED_MATERIALS.brushedSteel}
      >
        <boxGeometry args={[0.06, 0.72, depth - 0.1]} />
      </mesh>

      {/* Dual functional live-canvas monitor rig elevated & angled for clear inspection */}
      <Monitor
        position={[0, 0.77, -0.22]}
        screenColor={screenColor}
        dual={true}
        roomId={roomId}
      />

      {/* Mechanical Keyboard, Desk Mat & Wireless Mouse */}
      <mesh
        position={[-0.05, 0.775, 0.18]}
        geometry={SHARED_GEOMETRIES.keyboard}
        material={SHARED_MATERIALS.whiteCounter}
      />
      <mesh
        position={[0, 0.77, 0.17]}
        geometry={SHARED_GEOMETRIES.deskMat}
        material={SHARED_MATERIALS.brushedSteel}
      />
      <mesh
        position={[0.24, 0.778, 0.18]}
        geometry={SHARED_GEOMETRIES.mouse}
        material={SHARED_MATERIALS.whiteCounter}
      />

      {/* Ergonomic Office Chair offset slightly so backrest never occludes monitor screens */}
      <OfficeChair
        position={[0.22, 0, 0.68]}
        rotation={[0, Math.PI - 0.32, 0]}
        leatherColor="#334155"
      />
    </group>
  );
});
