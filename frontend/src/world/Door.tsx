import React from 'react';

interface DoorProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

export const Door: React.FC<DoorProps> = ({ position, rotation = [0, 0, 0] }) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Black steel architectural doorframe */}
      <mesh position={[-0.55, 1.05, 0]} castShadow>
        <boxGeometry args={[0.08, 2.1, 0.14]} />
        <meshStandardMaterial color="#181c24" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0.55, 1.05, 0]} castShadow>
        <boxGeometry args={[0.08, 2.1, 0.14]} />
        <meshStandardMaterial color="#181c24" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, 2.08, 0]} castShadow>
        <boxGeometry args={[1.18, 0.08, 0.14]} />
        <meshStandardMaterial color="#181c24" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Semi-open smoked glass door leaf with warm walnut handle */}
      <group position={[-0.5, 1.02, 0]} rotation={[0, 0.45, 0]}>
        <mesh position={[0.45, 0, 0]}>
          <boxGeometry args={[0.9, 2.0, 0.04]} />
          <meshPhysicalMaterial color="#cbd5e1" transparent opacity={0.32} roughness={0.15} />
        </mesh>
        <mesh position={[0.8, 0, 0.04]}>
          <boxGeometry args={[0.04, 0.28, 0.04]} />
          <meshStandardMaterial color="#6b4423" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
};
