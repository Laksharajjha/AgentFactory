import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorldStore } from '../state/worldStore';
import { AgentProfile } from '../types/agent';
import { CharacterAnimator, CharacterAnimationClip } from './CharacterAnimator';
import { CharacterBadge } from './CharacterBadge';

interface CharacterControllerProps {
  agent: AgentProfile;
}

export const CharacterController: React.FC<CharacterControllerProps> = React.memo(({ agent }) => {
  const groupRef = useRef<THREE.Group>(null);
  const walkingRef = useRef(false);
  const [isWalkingVisual, setIsWalkingVisual] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isSelected = useWorldStore((s) => s.selectedAgentId === agent.id);
  const focusCharacter = useWorldStore((s) => s.focusCharacter);
  const isSpeaking = useWorldStore((s) =>
    Boolean(
      s.activeMeeting &&
        ['ACTIVE', 'PRESENTING'].includes(s.activeMeeting.status) &&
        s.activeMeeting.active_speaker_id === agent.id
    )
  );
  const simulationSpeed = useWorldStore((s) => s.simulationSpeed);
  const isPaused = useWorldStore((s) => s.isPaused);
  const isolatedFloor = useWorldStore((s) => s.isolatedFloor);
  const ambientOverride = useWorldStore((s) => s.ambientOverrides[agent.id]);

  // Target destination determined by backend (or ambient override when IDLE)
  const destCoords = useMemo(() => {
    if (agent.state === 'IDLE' && ambientOverride?.targetPosition) {
      return ambientOverride.targetPosition;
    }
    return agent.target_position || agent.position;
  }, [agent.state, agent.target_position, agent.position, ambientOverride]);

  const targetVec = useMemo(
    () => new THREE.Vector3(destCoords[0], destCoords[1], destCoords[2]),
    [destCoords[0], destCoords[1], destCoords[2]]
  );

  // Initialize character position on first mount
  const initializedRef = useRef(false);
  React.useEffect(() => {
    if (groupRef.current && !initializedRef.current) {
      groupRef.current.position.set(agent.position[0], agent.position[1], agent.position[2]);
      initializedRef.current = true;
    }
  }, [agent.position]);

  const currentFloor = Math.round((agent.position[1] || 0) / 4.2);
  const isVisibleOnFloor = isolatedFloor === null || isolatedFloor === currentFloor;

  useFrame((_, delta) => {
    if (!groupRef.current || isPaused || !isVisibleOnFloor) return;

    const currentPos = groupRef.current.position;
    const dist = currentPos.distanceTo(targetVec);

    if (dist > 0.08) {
      if (!walkingRef.current) {
        walkingRef.current = true;
        setIsWalkingVisual(true);
      }
      const moveSpeed = 3.6 * Math.max(0.5, Math.min(5.0, simulationSpeed));
      const step = Math.min(dist, moveSpeed * delta);

      const dir = new THREE.Vector3().subVectors(targetVec, currentPos).normalize();
      currentPos.addScaledVector(dir, step);

      if (Math.abs(dir.x) > 0.01 || Math.abs(dir.z) > 0.01) {
        const targetAngle = Math.atan2(dir.x, dir.z);
        const currentRotY = groupRef.current.rotation.y;
        const diff = ((targetAngle - currentRotY + Math.PI) % (Math.PI * 2)) - Math.PI;
        groupRef.current.rotation.y += diff * Math.min(1, delta * 8);
      }
    } else {
      if (walkingRef.current) {
        walkingRef.current = false;
        setIsWalkingVisual(false);
      }
      currentPos.copy(targetVec);

      // Face North (-Z) toward the workstation monitor when at a desk, or face table center in Boardroom
      let targetRotY = Math.PI;
      if (agent.current_room_id === 'boardroom') {
        targetRotY = currentPos.z < 0 ? 0 : Math.PI;
      }
      const currentRotY = groupRef.current.rotation.y;
      const diff = ((targetRotY - currentRotY + Math.PI) % (Math.PI * 2)) - Math.PI;
      groupRef.current.rotation.y += diff * Math.min(1, delta * 6);
    }
  });

  const animationClip: CharacterAnimationClip = useMemo(() => {
    if (isWalkingVisual || agent.state === 'MOVING') return 'Walking';
    if (agent.state === 'PRESENTING') return 'Presenting';
    if (isSpeaking) return 'Talking';
    if (agent.state === 'IN_MEETING') return 'Listening';
    if (agent.state === 'WORKING' || agent.state === 'PLANNING' || agent.state === 'TASK_ASSIGNED') {
      return 'Typing';
    }
    if (agent.state === 'COMPLETED') return 'Celebrating';
    if (agent.state === 'WAITING' || agent.state === 'NEEDS_COLLABORATION') return 'Sitting';
    if (agent.state === 'IDLE' && ambientOverride?.animation) {
      return ambientOverride.animation;
    }
    return 'Typing';
  }, [isWalkingVisual, agent.state, isSpeaking, ambientOverride]);

  if (!isVisibleOnFloor) {
    return null;
  }

  const accentColor = agent.avatar_config?.accent_color || '#3b82f6';

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        focusCharacter(agent.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Subtle 3D floor marker halo ring */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, isSelected || isSpeaking || hovered ? 0.48 : 0.37, 20]} />
        <meshBasicMaterial
          color={isSelected ? '#f59e0b' : isSpeaking ? '#38bdf8' : accentColor}
          side={THREE.DoubleSide}
        />
      </mesh>

      <CharacterAnimator
        agent={agent}
        animation={animationClip}
        simulationSpeed={simulationSpeed}
        isPaused={isPaused}
      />

      <CharacterBadge
        agent={agent}
        isSelected={isSelected}
        isSpeaking={isSpeaking}
        isHovered={hovered}
        onSelect={() => focusCharacter(agent.id)}
      />
    </group>
  );
});
