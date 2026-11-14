import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorldStore, ROOM_LAYOUTS } from '../state/worldStore';
import { resolvePlayerMovement } from './collisionSystem';
import { soundEngine } from '../utils/soundEngine';

const EYE_HEIGHT = 1.68;

export const FirstPersonController: React.FC = () => {
  const { camera, gl } = useThree();
  const keysRef = useRef<Record<string, boolean>>({});
  const yawRef = useRef<number>(0); // Looking North (-Z) into the building
  const pitchRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const jumpVelocityRef = useRef<number>(0);
  const jumpOffsetRef = useRef<number>(0);
  const stepTimerRef = useRef<number>(0);

  const viewMode = useWorldStore((s) => s.viewMode);

  useEffect(() => {
    if (viewMode !== 'WALK') return;

    const pos = useWorldStore.getState().playerPosition;
    camera.position.set(pos[0], pos[1] + EYE_HEIGHT, pos[2]);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitchRef.current, yawRef.current, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
      ) {
        return;
      }
      const code = e.code;
      keysRef.current[code] = true;

      if (code === 'Space' && jumpOffsetRef.current <= 0.001) {
        jumpVelocityRef.current = 3.8;
      }

      if (code === 'KeyE') {
        const state = useWorldStore.getState();
        const hit = state.nearbyInteraction;
        if (!hit) return;
        if (hit.type === 'AGENT') {
          if (document.pointerLockElement) document.exitPointerLock();
          state.selectAgent(hit.id, false);
        } else if (hit.type === 'SCREEN') {
          if (document.pointerLockElement) document.exitPointerLock();
          state.setExpandedScreenRoomId(hit.roomId || hit.id);
        } else if (hit.type === 'MEETING') {
          if (document.pointerLockElement) document.exitPointerLock();
          state.setPresentationOpen(true);
        } else if (hit.type === 'ELEVATOR') {
          if (document.pointerLockElement) document.exitPointerLock();
          state.setElevatorModalOpen(true);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      const isLocked = document.pointerLockElement === gl.domElement;
      if (!isLocked && !isDraggingRef.current) return;

      const sensitivity = 0.0022;
      yawRef.current -= e.movementX * sensitivity;
      pitchRef.current = Math.max(
        -Math.PI / 2.4,
        Math.min(Math.PI / 2.4, pitchRef.current - e.movementY * sensitivity)
      );
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isDraggingRef.current = true;
      }
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    const onCanvasClick = () => {
      const state = useWorldStore.getState();
      if (
        !state.presentationOpen &&
        !state.factoryModalOpen &&
        !state.expandedScreenRoomId &&
        !state.elevatorModalOpen &&
        document.pointerLockElement !== gl.domElement
      ) {
        gl.domElement.requestPointerLock?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    gl.domElement.addEventListener('click', onCanvasClick);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      gl.domElement.removeEventListener('click', onCanvasClick);
      if (document.pointerLockElement === gl.domElement) {
        document.exitPointerLock?.();
      }
    };
  }, [viewMode, camera, gl]);

  useFrame((_, delta) => {
    if (viewMode !== 'WALK') return;

    const dt = Math.min(delta, 0.1);
    const keys = keysRef.current;

    const forwardInput =
      (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) -
      (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
    const strafeInput =
      (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) -
      (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);

    const isSprinting = Boolean(keys['ShiftLeft'] || keys['ShiftRight']);
    const moveSpeed = isSprinting ? 7.4 : 4.4;

    const state = useWorldStore.getState();
    const [cx, cy, cz] = state.playerPosition;

    let nx = cx;
    let ny = cy;
    let nz = cz;

    if (forwardInput !== 0 || strafeInput !== 0) {
      const forwardVec = new THREE.Vector3(
        -Math.sin(yawRef.current),
        0,
        -Math.cos(yawRef.current)
      ).normalize();
      const rightVec = new THREE.Vector3(
        Math.cos(yawRef.current),
        0,
        -Math.sin(yawRef.current)
      ).normalize();

      const moveDir = new THREE.Vector3()
        .addScaledVector(forwardVec, forwardInput)
        .addScaledVector(rightVec, strafeInput)
        .normalize();

      const proposed: [number, number, number] = [
        cx + moveDir.x * moveSpeed * dt,
        cy,
        cz + moveDir.z * moveSpeed * dt,
      ];

      const resolved = resolvePlayerMovement([cx, cy, cz], proposed);
      [nx, ny, nz] = resolved.position;
      state.setPlayerPosition([nx, ny, nz], resolved.roomId);

      stepTimerRef.current += dt * (isSprinting ? 1.6 : 1.0);
      if (stepTimerRef.current > 0.42) {
        stepTimerRef.current = 0;
        soundEngine.playFootstep();
      }
    }

    // Handle vertical jump offset
    if (jumpOffsetRef.current > 0 || jumpVelocityRef.current !== 0) {
      jumpOffsetRef.current += jumpVelocityRef.current * dt;
      jumpVelocityRef.current -= 9.8 * dt;
      if (jumpOffsetRef.current <= 0) {
        jumpOffsetRef.current = 0;
        jumpVelocityRef.current = 0;
      }
    }

    // Update camera transform
    camera.position.set(nx, ny + EYE_HEIGHT + jumpOffsetRef.current, nz);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitchRef.current, yawRef.current, 0);

    // Proximity detection for contextual [E] interactions
    const playerVec = new THREE.Vector3(nx, ny, nz);
    let closestInteraction: typeof state.nearbyInteraction = null;
    let minDistance = 2.85;

    // 1. Check Glass Elevator proximity (at x = -4.2, z = 0)
    const elevatorPos = new THREE.Vector3(-4.2, Math.round(ny / 4.2) * 4.2, 0);
    const elevDist = playerVec.distanceTo(elevatorPos);
    if (elevDist < 2.5) {
      minDistance = elevDist;
      closestInteraction = {
        type: 'ELEVATOR',
        id: 'elevator',
        label: 'Use Glass Elevator',
        sublabel: 'Switch between Ground, First & Second Floors',
      };
    }

    // 2. Check Employees proximity
    for (const agent of state.agents) {
      const [ax, ay, az] = agent.target_position || agent.position;
      if (Math.abs(ay - ny) > 1.8) continue;
      const dist = Math.hypot(ax - nx, az - nz);
      if (dist < minDistance) {
        minDistance = dist;
        closestInteraction = {
          type: 'AGENT',
          id: agent.id,
          label: `Talk to ${agent.name}`,
          sublabel: `${agent.role} • ${agent.state}`,
        };
      }
    }

    // 3. Check Room Screens / Boardroom proximity
    const currentFloor = Math.round(ny / 4.2);
    for (const room of ROOM_LAYOUTS) {
      if (room.floor !== currentFloor) continue;
      const [rx, , rz] = room.center;
      const dist = Math.hypot(rx - nx, rz - nz);
      if (dist < minDistance) {
        minDistance = dist;
        if (room.id === 'boardroom') {
          closestInteraction = {
            type: 'MEETING',
            id: 'boardroom',
            label: 'Observe Boardroom Session',
            sublabel: 'Open Live Split-View Presentation & Transcript',
          };
        } else {
          closestInteraction = {
            type: 'SCREEN',
            id: room.id,
            roomId: room.id,
            label: `Inspect ${room.name} Screen`,
            sublabel: 'View Live Engineering & Telemetry Display',
          };
        }
      }
    }

    const currentHit = state.nearbyInteraction;
    if (
      currentHit?.id !== closestInteraction?.id ||
      currentHit?.type !== closestInteraction?.type
    ) {
      state.setNearbyInteraction(closestInteraction);
    }
  });

  return null;
};
