import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorldStore } from '../state/worldStore';
import { SHARED_MATERIALS } from './sharedMaterials';

export const Elevator: React.FC = React.memo(() => {
  const cabinRef = useRef<THREE.Group>(null);
  const leftDoorRef = useRef<THREE.Mesh>(null);
  const rightDoorRef = useRef<THREE.Mesh>(null);

  const playerFloorY = useWorldStore((s) => Math.round(s.playerPosition[1] / 4.2) * 4.2);
  const doorsOpen = useWorldStore(
    (s) => s.elevatorModalOpen || s.nearbyInteraction?.type === 'ELEVATOR'
  );
  const isolatedFloor = useWorldStore((s) => s.isolatedFloor);

  // When a specific floor is isolated for room inspection, cap shaft height so it never protrudes above the isolated floor
  const shaftHeight = isolatedFloor !== null ? 3.2 : 12.6;
  const shaftCenterY = isolatedFloor !== null ? isolatedFloor * 4.2 + 1.6 : 6.3;

  useFrame((_, delta) => {
    if (cabinRef.current) {
      cabinRef.current.position.y = THREE.MathUtils.lerp(
        cabinRef.current.position.y,
        isolatedFloor !== null ? isolatedFloor * 4.2 : playerFloorY,
        Math.min(1, delta * 5)
      );
    }
    const targetLeftX = doorsOpen ? -0.58 : -0.26;
    const targetRightX = doorsOpen ? 0.58 : 0.26;
    if (leftDoorRef.current) {
      leftDoorRef.current.position.x = THREE.MathUtils.lerp(
        leftDoorRef.current.position.x,
        targetLeftX,
        Math.min(1, delta * 7)
      );
    }
    if (rightDoorRef.current) {
      rightDoorRef.current.position.x = THREE.MathUtils.lerp(
        rightDoorRef.current.position.x,
        targetRightX,
        Math.min(1, delta * 7)
      );
    }
  });

  return (
    <group position={[-4.2, 0, 0]}>
      {/* Panoramic Glass Elevator Shaft (Lightweight Standard Glass — Zero FBO Transmission) */}
      <mesh position={[0, shaftCenterY, 0]} material={SHARED_MATERIALS.balustradeGlass}>
        <boxGeometry args={[1.65, shaftHeight, 1.55]} />
      </mesh>

      {/* Structural Steel Corner Pillars */}
      {[
        [-0.82, -0.76],
        [0.82, -0.76],
        [-0.82, 0.76],
        [0.82, 0.76],
      ].map(([px, pz], idx) => (
        <mesh
          key={idx}
          position={[px, shaftCenterY, pz]}
          material={SHARED_MATERIALS.darkSteel}
        >
          <boxGeometry args={[0.08, shaftHeight + 0.1, 0.08]} />
        </mesh>
      ))}

      {/* Moving Elevator Cabin */}
      <group ref={cabinRef} position={[0, 0, 0]}>
        <mesh position={[0, 0.06, 0]} material={SHARED_MATERIALS.brushedSteel}>
          <boxGeometry args={[1.5, 0.1, 1.42]} />
        </mesh>
        <mesh position={[0, 2.55, 0]}>
          <boxGeometry args={[1.5, 0.08, 1.42]} />
          <meshBasicMaterial color="#fef3c7" />
        </mesh>
        <mesh position={[0, 1.3, -0.68]} material={SHARED_MATERIALS.fasciaWood}>
          <boxGeometry args={[1.46, 2.45, 0.05]} />
        </mesh>
        <mesh
          ref={leftDoorRef}
          position={[-0.26, 1.3, 0.7]}
          material={SHARED_MATERIALS.windowGlass}
        >
          <boxGeometry args={[0.5, 2.38, 0.04]} />
        </mesh>
        <mesh
          ref={rightDoorRef}
          position={[0.26, 1.3, 0.7]}
          material={SHARED_MATERIALS.windowGlass}
        >
          <boxGeometry args={[0.5, 2.38, 0.04]} />
        </mesh>
      </group>
    </group>
  );
});
