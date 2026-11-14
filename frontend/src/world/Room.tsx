import React, { useState } from 'react';
import { Html } from '@react-three/drei';
import { useWorldStore } from '../state/worldStore';
import { RoomDefinition } from '../types/world';
import { Door } from './Door';
import { GlassPartition } from './GlassPartition';
import { RoomContents } from './RoomContents';

interface RoomProps {
  room: RoomDefinition;
}

export const Room: React.FC<RoomProps> = React.memo(({ room }) => {
  const [hovered, setHovered] = useState(false);
  const isSelected = useWorldStore((s) => s.selectedRoomId === room.id);
  const focusRoom = useWorldStore((s) => s.focusRoom);
  const viewMode = useWorldStore((s) => s.viewMode);
  const anyModalOpen = useWorldStore(
    (s) =>
      Boolean(
        s.factoryModalOpen ||
          s.settingsModalOpen ||
          s.presentationOpen ||
          s.expandedScreenRoomId ||
          s.elevatorModalOpen
      )
  );

  // Narrow primitive selector so Room only re-renders when its own occupancy or meeting status changes
  const roomStatusSummary = useWorldStore((s) => {
    if (room.id === 'boardroom' && s.activeMeeting) {
      return `MTG:${s.activeMeeting.status}`;
    }
    let count = 0;
    let working = false;
    for (const a of s.agents) {
      if (a.current_room_id === room.id) {
        count += 1;
        if (['WORKING', 'PLANNING', 'PRESENTING', 'IN_MEETING'].includes(a.state)) {
          working = true;
        }
      }
    }
    return `${count}:${working ? '1' : '0'}`;
  });

  let statusColor = '#64748b';
  let statusLabel = '';
  if (roomStatusSummary.startsWith('MTG:')) {
    const mtgState = roomStatusSummary.slice(4);
    if (mtgState === 'PRESENTING') {
      statusColor = '#0284c7';
      statusLabel = 'PRESENTING';
    } else if (mtgState === 'ACTIVE') {
      statusColor = '#10b981';
      statusLabel = 'LIVE MEETING';
    } else {
      statusColor = '#f59e0b';
      statusLabel = 'GATHERING';
    }
  } else {
    const [countStr, workStr] = roomStatusSummary.split(':');
    const count = Number(countStr);
    if (workStr === '1') {
      statusColor = '#10b981';
      statusLabel = 'ACTIVE';
    } else if (count > 0) {
      statusColor = '#3b82f6';
      statusLabel = `${count} IN ROOM`;
    }
  }

  const { x, z, width, depth } = room.bounds;
  const y = room.y;

  const isOakFloor = ['ceo_office', 'boardroom', 'reception', 'product_room'].includes(room.id);
  const floorColor = isSelected
    ? '#bae6fd'
    : hovered
    ? '#e0f2fe'
    : isOakFloor
    ? '#d8b286'
    : '#e2e8f0';

  const corridorPartitionZ =
    room.id === 'boardroom' ? 0 : z < 0 ? z + depth / 2 : z - depth / 2;

  // Deliberate architectural cutaway: when inspecting a north-row room, hide its front corridor partition so camera has 100% clear view of desks & monitors
  const cutawayFrontPartition = isSelected && z < 0;

  // Show compact label ONLY on hover or selection in Dollhouse mode, positioned high at the back wall so it never blocks furniture or employees
  const showRoomLabel = viewMode === 'DOLLHOUSE' && !anyModalOpen && (hovered || isSelected);

  return (
    <group name={`room-${room.id}`}>
      {/* Interactive Room Floor Slab */}
      <mesh
        position={[x, y + 0.03, z]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          if (viewMode === 'DOLLHOUSE') {
            focusRoom(room.id, 'ARCHITECTURAL');
          }
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[width - 0.12, 0.05, depth - 0.12]} />
        <meshStandardMaterial color={floorColor} roughness={isOakFloor ? 0.48 : 0.64} />
      </mesh>

      {/* Subtle room selection / hover perimeter highlight */}
      {(isSelected || hovered) && (
        <mesh position={[x, y + 0.065, z]}>
          <boxGeometry args={[width - 0.04, 0.025, depth - 0.04]} />
          <meshBasicMaterial color={isSelected ? '#f59e0b' : room.accent_color} wireframe />
        </mesh>
      )}

      {/* Corridor Glass Partition & Door (Cut away when inspecting north-row rooms for unobstructed view) */}
      {!cutawayFrontPartition &&
        (room.id === 'boardroom' ? (
          <>
            <GlassPartition
              position={[x - width / 2, y + 1.45, -4.4]}
              args={[0.08, 2.85, 5.6]}
            />
            <GlassPartition
              position={[x - width / 2, y + 1.45, 4.4]}
              args={[0.08, 2.85, 5.6]}
            />
            <Door position={[x - width / 2, y, 0]} rotation={[0, Math.PI / 2, 0]} />
          </>
        ) : (
          <>
            <GlassPartition
              position={[x - width / 4 - 0.4, y + 1.45, corridorPartitionZ]}
              args={[width / 2 - 0.9, 2.85, 0.08]}
            />
            <GlassPartition
              position={[x + width / 4 + 0.4, y + 1.45, corridorPartitionZ]}
              args={[width / 2 - 0.9, 2.85, 0.08]}
            />
            <Door position={[x, y, corridorPartitionZ]} />
          </>
        ))}

      {/* Physical Status Beacon on Room Header */}
      <mesh position={[x, y + 2.92, corridorPartitionZ]}>
        <boxGeometry args={[1.4, 0.08, 0.1]} />
        <meshBasicMaterial color={statusColor} />
      </mesh>

      {/* Compact Non-Obstructive Hover / Selection Room Tooltip at Back Wall Header */}
      {showRoomLabel && (
        <Html
          position={[x, y + 2.95, z - depth * 0.38]}
          center
          zIndexRange={[15, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="px-2.5 py-0.5 rounded-full bg-slate-950/90 border border-slate-600/80 text-white shadow-lg flex items-center gap-1.5 whitespace-nowrap">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: statusColor }}
            />
            <span className="text-[11px] font-semibold tracking-tight">{room.name}</span>
            {statusLabel && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-800 text-amber-300 font-mono">
                {statusLabel}
              </span>
            )}
          </div>
        </Html>
      )}

      {/* Unique Room Furniture & Live Canvas Displays */}
      <RoomContents roomId={room.id} />
    </group>
  );
});
