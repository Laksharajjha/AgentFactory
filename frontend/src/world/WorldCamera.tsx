import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useWorldStore } from '../state/worldStore';

export const WorldCamera: React.FC = () => {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const cameraTarget = useWorldStore((s) => s.cameraTarget);
  const setCameraTarget = useWorldStore((s) => s.setCameraTarget);

  const desiredPos = useRef(new THREE.Vector3(22, 19, 22));
  const desiredLookAt = useRef(new THREE.Vector3(0, 4.2, 0));
  const isTransitioning = useRef(false);

  React.useEffect(() => {
    if (cameraTarget) {
      desiredPos.current.set(...cameraTarget.position);
      desiredLookAt.current.set(...cameraTarget.lookAt);
      isTransitioning.current = true;
    }
  }, [cameraTarget]);

  useFrame((_, delta) => {
    if (!isTransitioning.current || !cameraRef.current || !controlsRef.current) return;

    const step = Math.min(1, delta * 5.5);
    cameraRef.current.position.lerp(desiredPos.current, step);
    controlsRef.current.target.lerp(desiredLookAt.current, step);
    controlsRef.current.update();

    if (
      cameraRef.current.position.distanceTo(desiredPos.current) < 0.08 &&
      controlsRef.current.target.distanceTo(desiredLookAt.current) < 0.08
    ) {
      cameraRef.current.position.copy(desiredPos.current);
      controlsRef.current.target.copy(desiredLookAt.current);
      controlsRef.current.update();
      isTransitioning.current = false;
      setCameraTarget(null);
    }
  });

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        position={[22, 19, 22]}
        fov={36}
        near={0.35}
        far={220}
      />
      <OrbitControls
        ref={controlsRef}
        target={[0, 4.2, 0]}
        enableDamping
        dampingFactor={0.08}
        minDistance={2.2}
        maxDistance={58}
        maxPolarAngle={Math.PI / 2.12}
        minPolarAngle={0.15}
        onStart={() => {
          isTransitioning.current = false;
        }}
      />
    </>
  );
};
