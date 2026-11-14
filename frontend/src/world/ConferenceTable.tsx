import React from 'react';
import { OfficeChair } from './OfficeChair';

interface ConferenceTableProps {
  position: [number, number, number];
}

export const ConferenceTable: React.FC<ConferenceTableProps> = ({ position }) => {
  const seatOffsets: Array<{ pos: [number, number, number]; rot: number }> = [
    { pos: [-2.1, 0, -1.35], rot: 0 },
    { pos: [-0.6, 0, -1.35], rot: 0 },
    { pos: [0.9, 0, -1.35], rot: 0 },
    { pos: [2.4, 0, -1.35], rot: 0 },
    { pos: [-2.1, 0, 1.35], rot: Math.PI },
    { pos: [-0.6, 0, 1.35], rot: Math.PI },
    { pos: [0.9, 0, 1.35], rot: Math.PI },
    { pos: [2.4, 0, 1.35], rot: Math.PI },
  ];

  return (
    <group position={position}>
      {/* Warm architectural walnut conference slab */}
      <mesh position={[0.15, 0.74, 0]} castShadow receiveShadow>
        <boxGeometry args={[6.2, 0.08, 1.85]} />
        <meshStandardMaterial color="#5c3a1e" roughness={0.48} metalness={0.1} />
      </mesh>
      {/* Center black steel cable trough with subtle amber LED strip */}
      <mesh position={[0.15, 0.785, 0]}>
        <boxGeometry args={[4.4, 0.01, 0.24]} />
        <meshStandardMaterial color="#141820" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Heavy black steel architectural pedestals */}
      <mesh position={[-1.8, 0.36, 0]} castShadow>
        <boxGeometry args={[0.35, 0.72, 1.1]} />
        <meshStandardMaterial color="#141820" roughness={0.4} metalness={0.75} />
      </mesh>
      <mesh position={[2.1, 0.36, 0]} castShadow>
        <boxGeometry args={[0.35, 0.72, 1.1]} />
        <meshStandardMaterial color="#141820" roughness={0.4} metalness={0.75} />
      </mesh>

      {/* 8 Executive Boardroom Seats */}
      {seatOffsets.map((seat, idx) => (
        <OfficeChair
          key={idx}
          position={seat.pos}
          rotation={[0, seat.rot, 0]}
          leatherColor="#242b38"
        />
      ))}
    </group>
  );
};
