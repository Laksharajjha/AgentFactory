import { ROOM_LAYOUTS } from '../state/worldStore';

export interface CollisionResult {
  position: [number, number, number];
  roomId: string;
  roomName: string;
  floor: number;
}

const DOOR_CENTERS_NORTH = [-7.8, -0.4, 7.8, -6.8, 1.2, 8.0, -6.0, 6.0];
const DOOR_CENTERS_SOUTH = [-8.0, -0.5, 7.5, -5.8, 6.2, -5.8, 6.2];

function isNearDoor(x: number, doors: number[], halfWidth = 1.15): boolean {
  return doors.some((dx) => Math.abs(x - dx) <= halfWidth);
}

export function resolvePlayerMovement(
  current: [number, number, number],
  proposed: [number, number, number]
): CollisionResult {
  let [nx, ny, nz] = proposed;
  const [cx, , cz] = current;

  // Determine if player is on the central staircase zone (z in [0.15, 1.38], x in [-2.9, 1.4])
  const inStairZone = nz >= 0.15 && nz <= 1.38 && nx >= -2.9 && nx <= 1.4;
  if (inStairZone) {
    const dx = nx - cx;
    // Walking east (+x) climbs up; walking west (-x) walks down
    ny = Math.max(0, Math.min(8.4, ny + dx * 1.12));
  } else {
    // Snap smoothly to nearest floor level when stepping off stairs into corridor/rooms
    const nearestFloor = Math.round(ny / 4.2) * 4.2;
    if (Math.abs(ny - nearestFloor) < 0.65) {
      ny = nearestFloor;
    }
  }

  const floorIndex = Math.round(ny / 4.2);

  // Building outer boundary vs Outdoor Campus Plaza (accessible on Ground Floor via Reception entrance)
  const isGroundFloor = ny < 0.7;
  const inFrontEntrance = nx >= -9.8 && nx <= -5.8 && cz >= 6.5;
  const isOutside = cz > 7.55 || Math.abs(cx) > 11.6 || cz < -7.55;

  if (isGroundFloor && (inFrontEntrance || isOutside)) {
    // Clamp to outdoor campus bounds
    nx = Math.max(-24, Math.min(24, nx));
    nz = Math.max(-20, Math.min(22, nz));
    // Prevent walking through exterior walls from outside except through Reception entrance
    if (isOutside && nz <= 7.55 && nz >= -7.55 && Math.abs(nx) <= 11.6) {
      if (!(nx >= -9.8 && nx <= -5.8 && nz >= 6.8)) {
        nx = cx;
        nz = cz;
      }
    }
  } else {
    // Inside building exterior walls
    nx = Math.max(-11.3, Math.min(11.3, nx));
    nz = Math.max(-7.3, Math.min(7.3, nz));
  }

  // Check north corridor glass partition (z = -1.2)
  if ((cz > -1.05 && nz <= -1.05) || (cz < -1.35 && nz >= -1.35)) {
    if (!isNearDoor(nx, DOOR_CENTERS_NORTH)) {
      nz = cz;
    }
  }

  // Check south corridor glass partition (z = 1.2)
  if ((cz < 1.05 && nz >= 1.05) || (cz > 1.35 && nz <= 1.35)) {
    if (!isNearDoor(nx, DOOR_CENTERS_SOUTH)) {
      nz = cz;
    }
  }

  // Check room center furniture (desks / conference table) so player walks around desks
  for (const room of ROOM_LAYOUTS) {
    if (room.floor !== floorIndex) continue;
    const [rx, , rz] = room.center;
    const halfDeskW = room.id === 'boardroom' ? 2.1 : 1.05;
    const halfDeskD = room.id === 'boardroom' ? 0.75 : 0.45;
    if (
      Math.abs(nx - rx) < halfDeskW &&
      Math.abs(nz - rz) < halfDeskD
    ) {
      // Slide along whichever axis had less overlap
      if (Math.abs(cx - rx) >= halfDeskW) {
        nx = cx;
      } else {
        nz = cz;
      }
    }
  }

  // Identify current room or zone
  let roomId = 'corridor';
  let roomName = `Floor ${floorIndex} Central Corridor`;

  if (nz > 7.55 || Math.abs(nx) > 11.6 || nz < -7.55) {
    roomId = 'outdoor_campus';
    roomName = 'Outdoor Business Campus Plaza';
  } else {
    for (const room of ROOM_LAYOUTS) {
      if (room.floor !== floorIndex) continue;
      const [rx, , rz] = room.center;
      const [rw, rd] = room.size;
      if (
        Math.abs(nx - rx) <= rw / 2 &&
        Math.abs(nz - rz) <= rd / 2
      ) {
        roomId = room.id;
        roomName = room.name;
        break;
      }
    }
  }

  return {
    position: [nx, ny, nz],
    roomId,
    roomName,
    floor: floorIndex,
  };
}
