import React from 'react';
import { SHARED_MATERIALS } from './sharedMaterials';

interface WallProps {
  position: [number, number, number];
  args: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
}

export const Wall = React.memo<WallProps>(({
  position,
  args,
  rotation = [0, 0, 0],
}) => {
  return (
    <mesh
      position={position}
      rotation={rotation}
      receiveShadow
      material={SHARED_MATERIALS.galleryWall}
    >
      <boxGeometry args={args} />
    </mesh>
  );
});
