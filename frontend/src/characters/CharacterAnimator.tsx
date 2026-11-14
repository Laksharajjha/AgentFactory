import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AgentProfile } from '../types/agent';

export type CharacterAnimationClip =
  | 'Idle'
  | 'Walking'
  | 'Sitting'
  | 'Typing'
  | 'Talking'
  | 'Listening'
  | 'Presenting'
  | 'Thinking'
  | 'Reading'
  | 'Standing'
  | 'Celebrating';

interface CharacterAnimatorProps {
  agent: AgentProfile;
  animation: CharacterAnimationClip;
  simulationSpeed: number;
  isPaused: boolean;
}

export const CharacterAnimator: React.FC<CharacterAnimatorProps> = ({
  agent,
  animation,
  simulationSpeed,
  isPaused,
}) => {
  const bodyGroupRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftForearmRef = useRef<THREE.Group>(null);
  const rightForearmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);

  const cfg = agent.avatar_config || {
    suit_color: '#1e293b',
    shirt_color: '#f8fafc',
    accent_color: '#3b82f6',
    hair_color: '#1c1917',
    skin_color: '#e5b899',
    hair_style: 'short_parted',
    badge: 'AI',
  };

  useFrame((state, delta) => {
    if (isPaused) return;
    const t = state.clock.getElapsedTime() * Math.max(0.5, Math.min(3.5, simulationSpeed));
    const blend = Math.min(1, delta * 9);

    const body = bodyGroupRef.current;
    const torso = torsoRef.current;
    const head = headRef.current;
    const lArm = leftArmRef.current;
    const rArm = rightArmRef.current;
    const lFore = leftForearmRef.current;
    const rFore = rightForearmRef.current;
    const lLeg = leftLegRef.current;
    const rLeg = rightLegRef.current;
    if (!body || !torso || !head || !lArm || !rArm || !lFore || !rFore || !lLeg || !rLeg) return;

    let targetBodyY = 0;
    let targetTorsoX = 0;
    let targetTorsoY = 0;
    let targetHeadX = 0;
    let targetHeadY = 0;
    let targetHeadZ = 0;
    let targetLArmX = 0;
    let targetLArmZ = 0.05;
    let targetRArmX = 0;
    let targetRArmZ = -0.05;
    let targetLForeX = -0.15;
    let targetRForeX = -0.15;
    let targetLLegX = 0;
    let targetRLegX = 0;

    switch (animation) {
      case 'Walking': {
        const stride = Math.sin(t * 7.8);
        targetBodyY = Math.abs(Math.cos(t * 7.8)) * 0.045;
        targetTorsoX = 0.05;
        targetTorsoY = stride * 0.08;
        targetLLegX = stride * 0.62;
        targetRLegX = -stride * 0.62;
        targetLArmX = -stride * 0.48;
        targetRArmX = stride * 0.48;
        targetLForeX = -0.35 - Math.max(0, -stride) * 0.25;
        targetRForeX = -0.35 - Math.max(0, stride) * 0.25;
        targetHeadY = Math.sin(t * 2.4) * 0.08;
        break;
      }
      case 'Typing': {
        targetBodyY = -0.16;
        targetTorsoX = 0.08;
        targetLLegX = -1.12;
        targetRLegX = -1.12;
        targetLArmX = -0.62 + Math.sin(t * 16) * 0.08;
        targetRArmX = -0.62 + Math.cos(t * 16) * 0.08;
        targetLForeX = -0.78 + Math.sin(t * 20) * 0.12;
        targetRForeX = -0.78 + Math.cos(t * 20) * 0.12;
        targetHeadX = 0.14;
        targetHeadY = Math.sin(t * 2.2) * 0.12;
        break;
      }
      case 'Sitting':
      case 'Listening': {
        targetBodyY = -0.16;
        targetLLegX = -1.08;
        targetRLegX = -1.08;
        targetLArmX = -0.32;
        targetRArmX = -0.32;
        targetLForeX = -0.55;
        targetRForeX = -0.55;
        targetHeadY = Math.sin(t * 1.5) * 0.15;
        targetHeadX = Math.sin(t * 2.4) * 0.06;
        break;
      }
      case 'Talking': {
        targetBodyY = -0.12;
        targetLLegX = -0.95;
        targetRLegX = -0.95;
        targetLArmX = -0.55 + Math.sin(t * 5.8) * 0.22;
        targetRArmX = -0.5 + Math.cos(t * 5.2) * 0.22;
        targetLForeX = -0.65 + Math.sin(t * 6.5) * 0.2;
        targetRForeX = -0.65 + Math.cos(t * 6.0) * 0.2;
        targetHeadY = Math.sin(t * 3.5) * 0.18;
        targetHeadX = Math.sin(t * 7.0) * 0.06;
        break;
      }
      case 'Presenting': {
        targetBodyY = Math.sin(t * 3.0) * 0.02;
        targetTorsoY = Math.sin(t * 2.0) * 0.12;
        targetLArmX = -0.85 + Math.sin(t * 4.5) * 0.28;
        targetLArmZ = 0.32;
        targetLForeX = -0.45;
        targetRArmX = -0.45 + Math.cos(t * 4.0) * 0.18;
        targetRForeX = -0.5;
        targetHeadY = Math.sin(t * 2.2) * 0.24;
        break;
      }
      case 'Thinking': {
        targetBodyY = Math.sin(t * 1.8) * 0.012;
        targetLArmX = -0.45;
        targetLForeX = -0.8;
        targetRArmX = -0.95;
        targetRForeX = -1.15; // Hand raised thoughtfully near chin
        targetHeadX = -0.08 + Math.sin(t * 1.5) * 0.04;
        targetHeadZ = 0.07;
        targetHeadY = Math.sin(t * 1.1) * 0.14;
        break;
      }
      case 'Reading': {
        targetBodyY = Math.sin(t * 1.8) * 0.012;
        targetLArmX = -0.65;
        targetRArmX = -0.65;
        targetLForeX = -0.75;
        targetRForeX = -0.75;
        targetHeadX = 0.18;
        targetHeadY = Math.sin(t * 1.8) * 0.16;
        break;
      }
      case 'Celebrating': {
        targetBodyY = Math.abs(Math.sin(t * 6.0)) * 0.09;
        targetLArmX = -2.45 + Math.sin(t * 8.0) * 0.25;
        targetRArmX = -2.45 + Math.cos(t * 8.0) * 0.25;
        targetLArmZ = 0.25;
        targetRArmZ = -0.25;
        targetLForeX = -0.2;
        targetRForeX = -0.2;
        targetHeadY = Math.sin(t * 4.0) * 0.16;
        break;
      }
      case 'Standing':
      case 'Idle':
      default: {
        targetBodyY = Math.sin(t * 2.0) * 0.014;
        targetLArmX = Math.sin(t * 1.5) * 0.05;
        targetRArmX = -Math.sin(t * 1.5) * 0.05;
        targetLForeX = -0.18;
        targetRForeX = -0.18;
        targetHeadY = Math.sin(t * 1.2) * 0.12;
        break;
      }
    }

    body.position.y = THREE.MathUtils.lerp(body.position.y, targetBodyY, blend);
    torso.rotation.x = THREE.MathUtils.lerp(torso.rotation.x, targetTorsoX, blend);
    torso.rotation.y = THREE.MathUtils.lerp(torso.rotation.y, targetTorsoY, blend);
    head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, targetHeadX, blend);
    head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, targetHeadY, blend);
    head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, targetHeadZ, blend);
    lArm.rotation.x = THREE.MathUtils.lerp(lArm.rotation.x, targetLArmX, blend);
    lArm.rotation.z = THREE.MathUtils.lerp(lArm.rotation.z, targetLArmZ, blend);
    rArm.rotation.x = THREE.MathUtils.lerp(rArm.rotation.x, targetRArmX, blend);
    rArm.rotation.z = THREE.MathUtils.lerp(rArm.rotation.z, targetRArmZ, blend);
    lFore.rotation.x = THREE.MathUtils.lerp(lFore.rotation.x, targetLForeX, blend);
    rFore.rotation.x = THREE.MathUtils.lerp(rFore.rotation.x, targetRForeX, blend);
    lLeg.rotation.x = THREE.MathUtils.lerp(lLeg.rotation.x, targetLLegX, blend);
    rLeg.rotation.x = THREE.MathUtils.lerp(rLeg.rotation.x, targetRLegX, blend);
  });

  const renderHairStyle = () => {
    switch (cfg.hair_style) {
      case 'bun':
        return (
          <group>
            <mesh position={[0, 0.05, -0.01]} castShadow>
              <sphereGeometry args={[0.172, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
              <meshStandardMaterial color={cfg.hair_color} roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.16, -0.14]} castShadow>
              <sphereGeometry args={[0.075, 14, 14]} />
              <meshStandardMaterial color={cfg.hair_color} roughness={0.7} />
            </mesh>
          </group>
        );
      case 'sleek_bob':
        return (
          <group>
            <mesh position={[0, 0.04, -0.01]} castShadow>
              <sphereGeometry args={[0.176, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.68]} />
              <meshStandardMaterial color={cfg.hair_color} roughness={0.6} />
            </mesh>
            <mesh position={[-0.14, -0.03, 0.01]} castShadow>
              <boxGeometry args={[0.045, 0.2, 0.2]} />
              <meshStandardMaterial color={cfg.hair_color} roughness={0.6} />
            </mesh>
            <mesh position={[0.14, -0.03, 0.01]} castShadow>
              <boxGeometry args={[0.045, 0.2, 0.2]} />
              <meshStandardMaterial color={cfg.hair_color} roughness={0.6} />
            </mesh>
          </group>
        );
      case 'ponytail':
        return (
          <group>
            <mesh position={[0, 0.05, -0.01]} castShadow>
              <sphereGeometry args={[0.172, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
              <meshStandardMaterial color={cfg.hair_color} roughness={0.68} />
            </mesh>
            <mesh position={[0, 0.02, -0.18]} rotation={[0.4, 0, 0]} castShadow>
              <capsuleGeometry args={[0.045, 0.14, 8, 12]} />
              <meshStandardMaterial color={cfg.hair_color} roughness={0.68} />
            </mesh>
          </group>
        );
      case 'modern_quiff':
        return (
          <group>
            <mesh position={[0, 0.05, -0.01]} castShadow>
              <sphereGeometry args={[0.172, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
              <meshStandardMaterial color={cfg.hair_color} roughness={0.68} />
            </mesh>
            <mesh position={[0, 0.16, 0.08]} rotation={[-0.25, 0, 0]} castShadow>
              <boxGeometry args={[0.18, 0.065, 0.14]} />
              <meshStandardMaterial color={cfg.hair_color} roughness={0.68} />
            </mesh>
          </group>
        );
      case 'textured_crop':
      case 'short_parted':
      default:
        return (
          <group>
            <mesh position={[0, 0.05, -0.01]} castShadow>
              <sphereGeometry args={[0.172, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
              <meshStandardMaterial color={cfg.hair_color} roughness={0.72} />
            </mesh>
            <mesh position={[0.03, 0.14, 0.08]} rotation={[0, 0, -0.12]} castShadow>
              <boxGeometry args={[0.2, 0.05, 0.11]} />
              <meshStandardMaterial color={cfg.hair_color} roughness={0.72} />
            </mesh>
          </group>
        );
    }
  };

  return (
    <group ref={bodyGroupRef} scale={[1.06, 1.06, 1.06]}>
      {/* Articulated Upper Body & Torso */}
      <group ref={torsoRef} position={[0, 0.68, 0]}>
        {/* Lower Hips / Belt */}
        <mesh position={[0, 0.02, 0]} castShadow>
          <boxGeometry args={[0.37, 0.12, 0.22]} />
          <meshStandardMaterial color="#1e293b" roughness={0.65} />
        </mesh>

        {/* Tailored Blazer / Jacket */}
        <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.41, 0.48, 0.24]} />
          <meshStandardMaterial color={cfg.suit_color} roughness={0.55} metalness={0.08} />
        </mesh>

        {/* Rounded Shoulder Caps */}
        <mesh position={[-0.22, 0.47, 0]} castShadow>
          <sphereGeometry args={[0.072, 12, 12]} />
          <meshStandardMaterial color={cfg.suit_color} roughness={0.55} />
        </mesh>
        <mesh position={[0.22, 0.47, 0]} castShadow>
          <sphereGeometry args={[0.072, 12, 12]} />
          <meshStandardMaterial color={cfg.suit_color} roughness={0.55} />
        </mesh>

        {/* Crisp Inner Shirt & Collar */}
        <mesh position={[0, 0.34, 0.122]}>
          <boxGeometry args={[0.16, 0.32, 0.012]} />
          <meshStandardMaterial color={cfg.shirt_color} roughness={0.45} />
        </mesh>

        {/* Role Accent Tie / Lanyard & Employee ID Badge */}
        <mesh position={[0, 0.29, 0.128]}>
          <boxGeometry args={[0.048, 0.24, 0.012]} />
          <meshStandardMaterial color={cfg.accent_color} roughness={0.35} />
        </mesh>
        <mesh position={[0.09, 0.22, 0.128]}>
          <boxGeometry args={[0.065, 0.085, 0.012]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} />
        </mesh>
        <mesh position={[0.09, 0.25, 0.135]}>
          <boxGeometry args={[0.055, 0.02, 0.006]} />
          <meshBasicMaterial color={cfg.accent_color} />
        </mesh>

        {/* Neck */}
        <mesh position={[0, 0.57, 0]} castShadow>
          <cylinderGeometry args={[0.062, 0.072, 0.12, 14]} />
          <meshStandardMaterial color={cfg.skin_color} roughness={0.5} />
        </mesh>

        {/* Head & Facial Features */}
        <group ref={headRef} position={[0, 0.73, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.164, 22, 22]} />
            <meshStandardMaterial color={cfg.skin_color} roughness={0.5} />
          </mesh>

          {/* Ears */}
          <mesh position={[-0.16, 0, 0]}>
            <sphereGeometry args={[0.032, 10, 10]} />
            <meshStandardMaterial color={cfg.skin_color} roughness={0.55} />
          </mesh>
          <mesh position={[0.16, 0, 0]}>
            <sphereGeometry args={[0.032, 10, 10]} />
            <meshStandardMaterial color={cfg.skin_color} roughness={0.55} />
          </mesh>

          {/* Nose */}
          <mesh position={[0, -0.01, 0.165]}>
            <boxGeometry args={[0.028, 0.045, 0.032]} />
            <meshStandardMaterial color={cfg.skin_color} roughness={0.5} />
          </mesh>

          {/* Eyes (Sclera + Pupils) */}
          <mesh position={[-0.056, 0.02, 0.148]}>
            <sphereGeometry args={[0.022, 10, 10]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[-0.056, 0.02, 0.164]}>
            <sphereGeometry args={[0.012, 10, 10]} />
            <meshBasicMaterial color="#0f172a" />
          </mesh>

          <mesh position={[0.056, 0.02, 0.148]}>
            <sphereGeometry args={[0.022, 10, 10]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.056, 0.02, 0.164]}>
            <sphereGeometry args={[0.012, 10, 10]} />
            <meshBasicMaterial color="#0f172a" />
          </mesh>

          {/* Eyebrows */}
          <mesh position={[-0.056, 0.058, 0.152]} rotation={[0, 0, 0.06]}>
            <boxGeometry args={[0.045, 0.012, 0.012]} />
            <meshStandardMaterial color={cfg.hair_color} roughness={0.7} />
          </mesh>
          <mesh position={[0.056, 0.058, 0.152]} rotation={[0, 0, -0.06]}>
            <boxGeometry args={[0.045, 0.012, 0.012]} />
            <meshStandardMaterial color={cfg.hair_color} roughness={0.7} />
          </mesh>

          {/* Subtle Smile / Mouth */}
          <mesh position={[0, -0.065, 0.152]}>
            <boxGeometry args={[0.05, 0.01, 0.01]} />
            <meshStandardMaterial color="#9f5f53" roughness={0.6} />
          </mesh>

          {/* Stylized 3D Hair */}
          {renderHairStyle()}
        </group>

        {/* Left Arm (Upper + Articulated Forearm + Hand) */}
        <group ref={leftArmRef} position={[-0.25, 0.45, 0]}>
          <mesh position={[0, -0.12, 0]} castShadow>
            <capsuleGeometry args={[0.052, 0.16, 8, 12]} />
            <meshStandardMaterial color={cfg.suit_color} roughness={0.55} />
          </mesh>
          <group ref={leftForearmRef} position={[0, -0.24, 0]}>
            <mesh position={[0, -0.1, 0]} castShadow>
              <capsuleGeometry args={[0.045, 0.14, 8, 12]} />
              <meshStandardMaterial color={cfg.suit_color} roughness={0.55} />
            </mesh>
            <mesh position={[0, -0.22, 0]} castShadow>
              <sphereGeometry args={[0.046, 12, 12]} />
              <meshStandardMaterial color={cfg.skin_color} roughness={0.5} />
            </mesh>
          </group>
        </group>

        {/* Right Arm (Upper + Articulated Forearm + Hand) */}
        <group ref={rightArmRef} position={[0.25, 0.45, 0]}>
          <mesh position={[0, -0.12, 0]} castShadow>
            <capsuleGeometry args={[0.052, 0.16, 8, 12]} />
            <meshStandardMaterial color={cfg.suit_color} roughness={0.55} />
          </mesh>
          <group ref={rightForearmRef} position={[0, -0.24, 0]}>
            <mesh position={[0, -0.1, 0]} castShadow>
              <capsuleGeometry args={[0.045, 0.14, 8, 12]} />
              <meshStandardMaterial color={cfg.suit_color} roughness={0.55} />
            </mesh>
            <mesh position={[0, -0.22, 0]} castShadow>
              <sphereGeometry args={[0.046, 12, 12]} />
              <meshStandardMaterial color={cfg.skin_color} roughness={0.5} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Left Leg & Shoe */}
      <group ref={leftLegRef} position={[-0.1, 0.65, 0]}>
        <mesh position={[0, -0.27, 0]} castShadow>
          <capsuleGeometry args={[0.065, 0.42, 8, 12]} />
          <meshStandardMaterial color="#1e293b" roughness={0.65} />
        </mesh>
        <mesh position={[0, -0.58, 0.035]} castShadow>
          <boxGeometry args={[0.13, 0.075, 0.22]} />
          <meshStandardMaterial color="#0f172a" roughness={0.4} />
        </mesh>
        {/* White Sneaker/Loafer Sole */}
        <mesh position={[0, -0.615, 0.035]}>
          <boxGeometry args={[0.135, 0.02, 0.23]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.5} />
        </mesh>
      </group>

      {/* Right Leg & Shoe */}
      <group ref={rightLegRef} position={[0.1, 0.65, 0]}>
        <mesh position={[0, -0.27, 0]} castShadow>
          <capsuleGeometry args={[0.065, 0.42, 8, 12]} />
          <meshStandardMaterial color="#1e293b" roughness={0.65} />
        </mesh>
        <mesh position={[0, -0.58, 0.035]} castShadow>
          <boxGeometry args={[0.13, 0.075, 0.22]} />
          <meshStandardMaterial color="#0f172a" roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.615, 0.035]}>
          <boxGeometry args={[0.135, 0.02, 0.23]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
};
