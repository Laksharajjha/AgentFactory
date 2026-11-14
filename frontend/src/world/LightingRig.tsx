import React from 'react';
import { Sky } from '@react-three/drei';
import { useWorldStore } from '../state/worldStore';

export const LightingRig: React.FC = React.memo(() => {
  const daylightPreset = useWorldStore((s) => s.daylightPreset);
  const effectiveQuality = useWorldStore((s) => s.effectiveQuality);

  const presetConfig = {
    MORNING: {
      sunPosition: [45, 38, 55] as [number, number, number],
      sunColor: '#fff7ed',
      sunIntensity: 2.35,
      hemiSky: '#e0f2fe',
      hemiGround: '#d1fae5',
      hemiIntensity: 1.45,
      ambientIntensity: 0.85,
      turbidity: 2.4,
      rayleigh: 0.6,
    },
    DAYTIME: {
      // 10:00 AM - 2:00 PM bright natural daylight (Default)
      sunPosition: [48, 82, 46] as [number, number, number],
      sunColor: '#ffffff',
      sunIntensity: 2.65,
      hemiSky: '#f0f9ff',
      hemiGround: '#dcfce7',
      hemiIntensity: 1.65,
      ambientIntensity: 0.95,
      turbidity: 1.8,
      rayleigh: 0.45,
    },
    AFTERNOON: {
      sunPosition: [-52, 40, 50] as [number, number, number],
      sunColor: '#fef3c7',
      sunIntensity: 2.25,
      hemiSky: '#bae6fd',
      hemiGround: '#fde68a',
      hemiIntensity: 1.35,
      ambientIntensity: 0.85,
      turbidity: 3.0,
      rayleigh: 1.0,
    },
  }[daylightPreset];

  const shadowMapSize = effectiveQuality === 'HIGH' ? 2048 : 1024;
  const shadowsEnabled = effectiveQuality !== 'LOW';

  return (
    <group name="lighting-rig">
      {/* Bright Blue Daytime Sky Dome */}
      <Sky
        distance={450}
        sunPosition={presetConfig.sunPosition}
        turbidity={presetConfig.turbidity}
        rayleigh={presetConfig.rayleigh}
        mieCoefficient={0.004}
        mieDirectionalG={0.75}
      />

      {/* Global Illumination Approximation: Bright Sky & Landscaped Ground Bounce */}
      <hemisphereLight
        args={[presetConfig.hemiSky, presetConfig.hemiGround, presetConfig.hemiIntensity]}
        position={[0, 45, 0]}
      />

      {/* Bright Ambient Base Fill — Eliminates need for expensive per-room point lights */}
      <ambientLight intensity={presetConfig.ambientIntensity} color="#f8fafc" />

      {/* Single Primary Natural Sunlight Source with Selective Shadow Casting */}
      <directionalLight
        castShadow={shadowsEnabled}
        position={presetConfig.sunPosition}
        intensity={presetConfig.sunIntensity}
        color={presetConfig.sunColor}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-near={12}
        shadow-camera-far={150}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-bias={-0.0005}
      />
    </group>
  );
});
