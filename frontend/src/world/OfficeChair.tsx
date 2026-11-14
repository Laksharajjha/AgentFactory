import React from 'react';

interface OfficeChairProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  leatherColor?: string;
}

export const OfficeChair: React.FC<OfficeChairProps> = ({
  position,
  rotation = [0, 0, 0],
  leatherColor = '#1e2430',
}) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Base star pedestal */}
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.28, 0.04, 12]} />
        <meshStandardMaterial color="#11151c" roughness={0.35} metalness={0.8} />
      </mesh>
      {/* Pneumatic cylinder */}
      <mesh position={[0, 0.24, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.36, 10]} />
        <meshStandardMaterial color="#11151c" roughness={0.3} metalness={0.85} />
      </mesh>
      {/* Seat cushion */}
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.52, 0.07, 0.5]} />
        <meshStandardMaterial color={leatherColor} roughness={0.65} metalness={0.1} />
      </mesh>
      {/* Ergonomic backrest with warm walnut rear shell */}
      <mesh position={[0, 0.78, -0.22]} castShadow>
        <boxGeometry args={[0.48, 0.62, 0.06]} />
        <meshStandardMaterial color={leatherColor} roughness={0.65} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.78, -0.255]} castShadow>
        <boxGeometry args={[0.46, 0.58, 0.02]} />
        <meshStandardMaterial color="#5c3a1e" roughness={0.55} />
      </mesh>
    </group>
  );
};
