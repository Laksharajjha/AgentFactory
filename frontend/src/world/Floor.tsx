import React from 'react';
import { RoomDefinition } from '../types/world';
import { Room } from './Room';
import { Wall } from './Wall';
import { Window } from './Window';
import { SHARED_GEOMETRIES, SHARED_MATERIALS } from './sharedMaterials';

interface FloorProps {
  floorIndex: number;
  y: number;
  rooms: RoomDefinition[];
  visible: boolean;
}

const COLUMN_COORDS: Array<[number, number]> = [
  [-11.8, -7.8],
  [11.8, -7.8],
  [-11.8, 7.8],
  [11.8, 7.8],
  [1.8, -7.8],
  [1.8, 7.8],
];

export const Floor: React.FC<FloorProps> = React.memo(({ floorIndex, y, rooms, visible }) => {
  if (!visible) return null;

  return (
    <group name={`floor-${floorIndex}`}>
      {/* Bright Polished Architectural Concrete Floor Slab */}
      <mesh
        position={[0, y - 0.1, 0]}
        receiveShadow
        material={SHARED_MATERIALS.concreteSlab}
      >
        <boxGeometry args={[24.0, 0.2, 16.0]} />
      </mesh>

      {/* Warm Natural Wood Perimeter Fascia */}
      <mesh position={[0, y - 0.1, 8.02]} material={SHARED_MATERIALS.fasciaWood}>
        <boxGeometry args={[24.1, 0.24, 0.08]} />
      </mesh>
      <mesh position={[12.02, y - 0.1, 0]} material={SHARED_MATERIALS.fasciaWood}>
        <boxGeometry args={[0.08, 0.24, 16.1]} />
      </mesh>

      {/* Bright Terrazzo Central Corridor Spine */}
      <mesh position={[-2.5, y + 0.015, 0]} receiveShadow material={SHARED_MATERIALS.corridorTerrazzo}>
        <boxGeometry args={[18.2, 0.03, 2.5]} />
      </mesh>

      {/* North & West Architectural Walls with Expansive Floor-to-Ceiling Daylight Windows */}
      <Wall position={[0, y + 1.65, -7.85]} args={[24.0, 3.3, 0.24]} />
      <Window position={[-7.5, y + 1.7, -7.8]} args={[6.2, 2.45, 0.28]} />
      <Window position={[4.5, y + 1.7, -7.8]} args={[9.2, 2.45, 0.28]} />

      <Wall position={[-11.85, y + 1.65, 0]} args={[0.24, 3.3, 16.0]} />
      <Window position={[-11.8, y + 1.7, -4.2]} args={[0.28, 2.45, 5.2]} />
      <Window position={[-11.8, y + 1.7, 4.2]} args={[0.28, 2.45, 5.2]} />

      {/* Cutaway South & East Glass Balustrades for Unobstructed Daylight & Dollhouse View */}
      <mesh position={[0, y + 0.45, 7.88]} material={SHARED_MATERIALS.balustradeGlass}>
        <boxGeometry args={[24.0, 0.9, 0.08]} />
      </mesh>
      <mesh position={[11.88, y + 0.45, 0]} material={SHARED_MATERIALS.balustradeGlass}>
        <boxGeometry args={[0.08, 0.9, 16.0]} />
      </mesh>

      {/* Walkable Oak & Steel Architectural Staircase connecting to upper floor */}
      {floorIndex < 2 && (
        <group position={[-2.6, y, 0.85]}>
          {Array.from({ length: 12 }).map((_, stepIdx) => (
            <mesh
              key={stepIdx}
              position={[stepIdx * 0.3, stepIdx * 0.35 + 0.18, 0]}
              geometry={SHARED_GEOMETRIES.stairStep}
              material={SHARED_MATERIALS.fasciaWood}
            />
          ))}
          <mesh
            position={[1.65, 2.1, -0.55]}
            rotation={[0, 0, 0.86]}
            material={SHARED_MATERIALS.brushedSteel}
          >
            <boxGeometry args={[5.1, 0.1, 0.06]} />
          </mesh>
          <mesh
            position={[1.65, 2.6, 0.55]}
            rotation={[0, 0, 0.86]}
            material={SHARED_MATERIALS.balustradeGlass}
          >
            <boxGeometry args={[5.1, 0.65, 0.04]} />
          </mesh>
        </group>
      )}

      {/* Structural Architectural Columns */}
      {COLUMN_COORDS.map(([cx, cz], idx) => (
        <mesh
          key={idx}
          position={[cx, y + 2.0, cz]}
          geometry={SHARED_GEOMETRIES.column}
          material={SHARED_MATERIALS.brushedSteel}
        />
      ))}

      {/* Rooms on this floor */}
      {rooms.map((room) => (
        <Room key={room.id} room={room} />
      ))}
    </group>
  );
});
