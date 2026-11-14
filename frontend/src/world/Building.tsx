import React from 'react';
import { useWorldStore } from '../state/worldStore';
import { Floor } from './Floor';
import { OutdoorCampus } from './OutdoorCampus';
import { Elevator } from './Elevator';
import { SHARED_MATERIALS } from './sharedMaterials';

const FLOORS = [
  { index: 0, y: 0.0 },
  { index: 1, y: 4.2 },
  { index: 2, y: 8.4 },
];

export const Building: React.FC = React.memo(() => {
  const rooms = useWorldStore((s) => s.rooms);
  const isolatedFloor = useWorldStore((s) => s.isolatedFloor);

  return (
    <group name="project-forge-building">
      {/* Surrounding Landscaped Silicon Valley Business Campus */}
      <OutdoorCampus />

      {/* Warm Travertine / Limestone Architectural Plinth */}
      <mesh position={[0, -0.18, 0]} receiveShadow>
        <boxGeometry args={[26.5, 0.28, 17.5]} />
        <meshStandardMaterial color="#e5e0d5" roughness={0.65} metalness={0.05} />
      </mesh>

      {/* Panoramic Glass Elevator spanning Floors 0, 1, 2 */}
      <Elevator />

      {/* Three Building Storeys */}
      {FLOORS.map((f) => {
        const floorRooms = rooms.filter((r) => r.floor === f.index);
        const isVisible = isolatedFloor === null || isolatedFloor === f.index;
        return (
          <Floor
            key={f.index}
            floorIndex={f.index}
            y={f.y}
            rooms={floorRooms}
            visible={isVisible}
          />
        );
      })}

      {/* Architectural Roof Perimeter Frame & Open Skylight Louvers */}
      {isolatedFloor === null && (
        <group position={[0, 11.2, 0]}>
          <mesh position={[0, 0, -7.5]} material={SHARED_MATERIALS.brushedSteel}>
            <boxGeometry args={[24.4, 0.22, 0.35]} />
          </mesh>
          <mesh position={[0, 0, 7.5]} material={SHARED_MATERIALS.brushedSteel}>
            <boxGeometry args={[24.4, 0.22, 0.35]} />
          </mesh>
          <mesh position={[-12.0, 0, 0]} material={SHARED_MATERIALS.brushedSteel}>
            <boxGeometry args={[0.35, 0.22, 15.2]} />
          </mesh>
          <mesh position={[12.0, 0, 0]} material={SHARED_MATERIALS.brushedSteel}>
            <boxGeometry args={[0.35, 0.22, 15.2]} />
          </mesh>
        </group>
      )}
    </group>
  );
});
