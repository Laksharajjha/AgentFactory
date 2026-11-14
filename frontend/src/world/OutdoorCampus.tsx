import React, { useMemo } from 'react';
import { Instance, Instances } from '@react-three/drei';

const TREE_POSITIONS: Array<{ pos: [number, number, number]; scale: number }> = [
  // North campus grove (visible through north windows)
  { pos: [-22, 0, -16], scale: 1.2 },
  { pos: [-16, 0, -18], scale: 1.4 },
  { pos: [-10, 0, -15], scale: 1.1 },
  { pos: [-4, 0, -19], scale: 1.35 },
  { pos: [3, 0, -16], scale: 1.15 },
  { pos: [10, 0, -18], scale: 1.45 },
  { pos: [16, 0, -15], scale: 1.25 },
  { pos: [22, 0, -17], scale: 1.3 },
  // West campus lawn (visible through CEO & Reception windows)
  { pos: [-20, 0, -9], scale: 1.3 },
  { pos: [-18, 0, -3], scale: 1.15 },
  { pos: [-21, 0, 3], scale: 1.4 },
  { pos: [-18, 0, 9], scale: 1.2 },
  { pos: [-23, 0, 14], scale: 1.35 },
  // East campus garden (outside Boardroom & Engineering)
  { pos: [19, 0, -10], scale: 1.25 },
  { pos: [18, 0, -4], scale: 1.1 },
  { pos: [20, 0, 2], scale: 1.35 },
  { pos: [18, 0, 8], scale: 1.2 },
  { pos: [22, 0, 13], scale: 1.4 },
  // South courtyard & promenade
  { pos: [-16, 0, 16], scale: 1.25 },
  { pos: [-11, 0, 18], scale: 1.15 },
  { pos: [11, 0, 18], scale: 1.2 },
  { pos: [16, 0, 16], scale: 1.3 },
  // Outer perimeter trees
  { pos: [-30, 0, -24], scale: 1.6 },
  { pos: [-28, 0, 0], scale: 1.5 },
  { pos: [-30, 0, 22], scale: 1.6 },
  { pos: [30, 0, -24], scale: 1.55 },
  { pos: [29, 0, 0], scale: 1.5 },
  { pos: [30, 0, 22], scale: 1.65 },
];

export const OutdoorCampus: React.FC = React.memo(() => {
  const trunkGeometryArgs = useMemo<[number, number, number, number]>(() => [0.22, 0.32, 2.4, 8], []);
  const canopyGeometryArgs = useMemo<[number, number]>(() => [1.65, 2], []);

  return (
    <group name="outdoor-silicon-valley-campus" position={[0, -0.22, 0]}>
      {/* Expansive Landscaped Green Campus Lawn */}
      <mesh position={[0, -0.08, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color="#65a368" roughness={0.92} metalness={0.02} />
      </mesh>

      {/* Inner Manicured Campus Courtyard Grass */}
      <mesh position={[0, -0.04, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[56, 44]} />
        <meshStandardMaterial color="#74b477" roughness={0.88} />
      </mesh>

      {/* Architectural Limestone Building Plinth & Terrace */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[28.4, 0.16, 20.4]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.75} />
      </mesh>

      {/* Main Entrance Limestone Walking Path & Plaza */}
      <mesh position={[-5.5, 0.01, 15.0]} receiveShadow>
        <boxGeometry args={[5.5, 0.06, 12.0]} />
        <meshStandardMaterial color="#d6d3d1" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.01, 13.5]} receiveShadow>
        <boxGeometry args={[36.0, 0.06, 3.2]} />
        <meshStandardMaterial color="#d6d3d1" roughness={0.8} />
      </mesh>

      {/* Campus Access Road & Crosswalk in South Foreground */}
      <mesh position={[0, 0.0, 24.5]} receiveShadow>
        <boxGeometry args={[140.0, 0.05, 6.5]} />
        <meshStandardMaterial color="#475569" roughness={0.85} />
      </mesh>
      {/* Dashed Road Centerline */}
      {[-36, -24, -12, 0, 12, 24, 36].map((rx) => (
        <mesh key={rx} position={[rx, 0.035, 24.5]}>
          <boxGeometry args={[4.5, 0.01, 0.18]} />
          <meshBasicMaterial color="#f8fafc" />
        </mesh>
      ))}

      {/* Campus Parking Bay & Modern Stylized EVs (West Lot) */}
      <mesh position={[-25, 0.01, 16.5]} receiveShadow>
        <boxGeometry args={[12.0, 0.05, 8.5]} />
        <meshStandardMaterial color="#64748b" roughness={0.85} />
      </mesh>
      {[
        { x: -27.5, z: 15.5, color: '#f8fafc' },
        { x: -24.5, z: 15.5, color: '#38bdf8' },
        { x: -21.5, z: 15.5, color: '#1e293b' },
      ].map((car, i) => (
        <group key={i} position={[car.x, 0.42, car.z]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.85, 0.55, 3.8]} />
            <meshStandardMaterial color={car.color} roughness={0.25} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0.4, -0.2]} castShadow>
            <boxGeometry args={[1.55, 0.42, 2.1]} />
            <meshStandardMaterial color="#0f172a" roughness={0.15} metalness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Outdoor Collaborative Courtyard Tables & Benches (East & South Plaza) */}
      {[
        [-12.5, 16.5],
        [4.5, 16.5],
        [15.8, -2.5],
        [15.8, 3.5],
      ].map(([bx, bz], idx) => (
        <group key={idx} position={[bx, 0.05, bz]}>
          {/* Stone patio pad */}
          <mesh position={[0, 0.02, 0]} receiveShadow>
            <cylinderGeometry args={[2.1, 2.1, 0.05, 16]} />
            <meshStandardMaterial color="#e7e5e4" roughness={0.8} />
          </mesh>
          {/* Warm wood picnic table */}
          <mesh position={[0, 0.55, 0]} castShadow>
            <cylinderGeometry args={[0.9, 0.9, 0.06, 16]} />
            <meshStandardMaterial color="#b47b48" roughness={0.55} />
          </mesh>
          {/* Parasol pole & white canvas umbrella */}
          <mesh position={[0, 1.35, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 2.6, 8]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0, 2.55, 0]} castShadow>
            <coneGeometry args={[1.75, 0.55, 12]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Decorative Landscaped Hedge Beds Around Building Perimeter */}
      {[
        { pos: [-7.5, 0.35, -9.2] as [number, number, number], size: [8.0, 0.55, 1.1] as [number, number, number] },
        { pos: [5.5, 0.35, -9.2] as [number, number, number], size: [10.0, 0.55, 1.1] as [number, number, number] },
        { pos: [6.0, 0.35, 9.2] as [number, number, number], size: [9.0, 0.55, 1.1] as [number, number, number] },
      ].map((hedge, idx) => (
        <mesh key={idx} position={hedge.pos} castShadow receiveShadow>
          <boxGeometry args={hedge.size} />
          <meshStandardMaterial color="#3f7d44" roughness={0.85} />
        </mesh>
      ))}

      {/* Instanced Campus Trees (Trunks + Foliage Canopies) for High Performance */}
      <Instances limit={TREE_POSITIONS.length} castShadow receiveShadow>
        <cylinderGeometry args={trunkGeometryArgs} />
        <meshStandardMaterial color="#6b4423" roughness={0.85} />
        {TREE_POSITIONS.map((t, i) => (
          <Instance
            key={`trunk-${i}`}
            position={[t.pos[0], 1.2 * t.scale, t.pos[2]]}
            scale={[t.scale, t.scale, t.scale]}
          />
        ))}
      </Instances>

      <Instances limit={TREE_POSITIONS.length} castShadow receiveShadow>
        <dodecahedronGeometry args={canopyGeometryArgs} />
        <meshStandardMaterial color="#3b7a40" roughness={0.8} />
        {TREE_POSITIONS.map((t, i) => (
          <Instance
            key={`canopy-${i}`}
            position={[t.pos[0], 3.1 * t.scale, t.pos[2]]}
            scale={[t.scale, t.scale * 1.15, t.scale]}
          />
        ))}
      </Instances>

      {/* Distant Neighbouring Modern Technology Campus Buildings */}
      {[
        { pos: [-45, 7, -38] as [number, number, number], size: [22, 14, 14] as [number, number, number] },
        { pos: [0, 9, -44] as [number, number, number], size: [28, 18, 14] as [number, number, number] },
        { pos: [44, 6.5, -36] as [number, number, number], size: [20, 13, 14] as [number, number, number] },
        { pos: [48, 8, 12] as [number, number, number], size: [16, 16, 22] as [number, number, number] },
        { pos: [-48, 7.5, 10] as [number, number, number], size: [16, 15, 20] as [number, number, number] },
      ].map((bldg, idx) => (
        <group key={idx} position={bldg.pos}>
          <mesh receiveShadow castShadow>
            <boxGeometry args={bldg.size} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.5} metalness={0.15} />
          </mesh>
          {/* Curtain-wall glass band */}
          <mesh position={[0, 0, bldg.size[2] / 2 + 0.05]}>
            <planeGeometry args={[bldg.size[0] - 1.5, bldg.size[1] - 2.0]} />
            <meshStandardMaterial color="#93c5fd" roughness={0.2} metalness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
});
