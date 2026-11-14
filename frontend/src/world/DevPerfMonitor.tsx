import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useWorldStore } from '../state/worldStore';

export interface PerfMetricsSnapshot {
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  activeCharacters: number;
  effectiveQuality: string;
}

export const latestPerfMetrics: PerfMetricsSnapshot = {
  fps: 60,
  frameTimeMs: 16.6,
  drawCalls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  activeCharacters: 6,
  effectiveQuality: 'HIGH',
};

export const DevPerfSampler: React.FC = () => {
  const { gl } = useThree();
  const framesRef = useRef(0);
  const accumTimeRef = useRef(0);
  const lowFpsStreakRef = useRef(0);

  useFrame((_, delta) => {
    framesRef.current += 1;
    accumTimeRef.current += delta;

    if (accumTimeRef.current >= 0.75) {
      const fps = Math.round(framesRef.current / accumTimeRef.current);
      const frameTimeMs = Number(((accumTimeRef.current / framesRef.current) * 1000).toFixed(1));
      const state = useWorldStore.getState();

      latestPerfMetrics.fps = fps;
      latestPerfMetrics.frameTimeMs = frameTimeMs;
      latestPerfMetrics.drawCalls = gl.info.render.calls;
      latestPerfMetrics.triangles = gl.info.render.triangles;
      latestPerfMetrics.geometries = gl.info.memory.geometries;
      latestPerfMetrics.textures = gl.info.memory.textures;
      latestPerfMetrics.activeCharacters = state.isPaused ? 0 : state.agents.length;
      latestPerfMetrics.effectiveQuality = state.effectiveQuality;

      // Automatic quality adjustment when qualityPreset === 'AUTO'
      if (state.qualityPreset === 'AUTO') {
        if (fps < 32) {
          lowFpsStreakRef.current += 1;
          if (lowFpsStreakRef.current >= 3) {
            if (state.effectiveQuality === 'HIGH') {
              state.setEffectiveQuality('MEDIUM');
            } else if (state.effectiveQuality === 'MEDIUM') {
              state.setEffectiveQuality('LOW');
            }
            lowFpsStreakRef.current = 0;
          }
        } else {
          lowFpsStreakRef.current = 0;
        }
      }

      framesRef.current = 0;
      accumTimeRef.current = 0;
    }
  });

  return null;
};

export const DevPerfOverlay: React.FC = () => {
  const devPerfOpen = useWorldStore((s) => s.devPerfOpen);
  const setDevPerfOpen = useWorldStore((s) => s.setDevPerfOpen);
  const qualityPreset = useWorldStore((s) => s.qualityPreset);
  const effectiveQuality = useWorldStore((s) => s.effectiveQuality);
  const setQualityPreset = useWorldStore((s) => s.setQualityPreset);
  const [, forceTick] = React.useState(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyP') {
        e.preventDefault();
        setDevPerfOpen(!useWorldStore.getState().devPerfOpen);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setDevPerfOpen]);

  useEffect(() => {
    if (!devPerfOpen) return;
    const id = window.setInterval(() => forceTick((n) => n + 1), 750);
    return () => window.clearInterval(id);
  }, [devPerfOpen]);

  if (!devPerfOpen) return null;

  return (
    <div className="absolute top-16 right-3 z-30 w-64 rounded-xl bg-slate-950/95 border border-slate-700/90 p-3 text-[11px] font-mono text-slate-200 shadow-2xl select-none">
      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
        <span className="font-bold text-amber-400">DEV PERF TELEMETRY</span>
        <button
          onClick={() => setDevPerfOpen(false)}
          className="text-slate-400 hover:text-white px-1"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-2 gap-y-1 text-[10px]">
        <span className="text-slate-400">FPS:</span>
        <span
          className={`text-right font-bold ${
            latestPerfMetrics.fps >= 45
              ? 'text-emerald-400'
              : latestPerfMetrics.fps >= 28
              ? 'text-amber-400'
              : 'text-red-400'
          }`}
        >
          {latestPerfMetrics.fps} FPS
        </span>

        <span className="text-slate-400">Frame Time:</span>
        <span className="text-right text-white">{latestPerfMetrics.frameTimeMs} ms</span>

        <span className="text-slate-400">Draw Calls:</span>
        <span className="text-right text-sky-300">{latestPerfMetrics.drawCalls}</span>

        <span className="text-slate-400">Triangles:</span>
        <span className="text-right text-white">
          {latestPerfMetrics.triangles.toLocaleString()}
        </span>

        <span className="text-slate-400">Geometries:</span>
        <span className="text-right text-white">{latestPerfMetrics.geometries}</span>

        <span className="text-slate-400">Textures:</span>
        <span className="text-right text-white">{latestPerfMetrics.textures}</span>

        <span className="text-slate-400">Active Agents:</span>
        <span className="text-right text-emerald-300">{latestPerfMetrics.activeCharacters}</span>

        <span className="text-slate-400">Quality Tier:</span>
        <span className="text-right text-amber-300">
          {qualityPreset} ({effectiveQuality})
        </span>
      </div>

      <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between gap-1">
        {(['AUTO', 'HIGH', 'MEDIUM', 'LOW'] as const).map((q) => (
          <button
            key={q}
            onClick={() => setQualityPreset(q)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
              qualityPreset === q
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
};
