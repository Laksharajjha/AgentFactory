import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import {
  ArrowLeft,
  ArrowUpDown,
  Building2,
  Compass,
  Eye,
  Footprints,
  Maximize2,
  Monitor,
  Sparkles,
  X,
} from 'lucide-react';
import { Character } from '../characters/Character';
import { useWorldStore, ROOM_LAYOUTS } from '../state/worldStore';
import { Building } from './Building';
import { DevPerfOverlay, DevPerfSampler } from './DevPerfMonitor';
import { FirstPersonController } from './FirstPersonController';
import { LightingRig } from './LightingRig';
import { NavigationController } from './NavigationController';
import { WorldCamera } from './WorldCamera';
import { soundEngine } from '../utils/soundEngine';

export const WorldScene: React.FC = () => {
  const agents = useWorldStore((s) => s.agents);
  const rooms = useWorldStore((s) => s.rooms);
  const viewMode = useWorldStore((s) => s.viewMode);
  const daylightPreset = useWorldStore((s) => s.daylightPreset);
  const effectiveQuality = useWorldStore((s) => s.effectiveQuality);
  const isolatedFloor = useWorldStore((s) => s.isolatedFloor);
  const selectedRoomId = useWorldStore((s) => s.selectedRoomId);
  const roomInspectionMode = useWorldStore((s) => s.roomInspectionMode);

  // Centralized Camera Actions
  const focusBuilding = useWorldStore((s) => s.focusBuilding);
  const focusFloor = useWorldStore((s) => s.focusFloor);
  const focusRoom = useWorldStore((s) => s.focusRoom);
  const enterInteriorView = useWorldStore((s) => s.enterInteriorView);
  const enterWalkMode = useWorldStore((s) => s.enterWalkMode);
  const exitWalkMode = useWorldStore((s) => s.exitWalkMode);
  const selectAgent = useWorldStore((s) => s.selectAgent);

  const playerPosition = useWorldStore((s) => s.playerPosition);
  const playerRoomId = useWorldStore((s) => s.playerRoomId);
  const nearbyInteraction = useWorldStore((s) => s.nearbyInteraction);
  const setExpandedScreenRoomId = useWorldStore((s) => s.setExpandedScreenRoomId);
  const setPresentationOpen = useWorldStore((s) => s.setPresentationOpen);
  const elevatorModalOpen = useWorldStore((s) => s.elevatorModalOpen);
  const setElevatorModalOpen = useWorldStore((s) => s.setElevatorModalOpen);
  const teleportPlayerToFloor = useWorldStore((s) => s.teleportPlayerToFloor);

  const skyBg =
    daylightPreset === 'MORNING'
      ? '#dbeafe'
      : daylightPreset === 'AFTERNOON'
      ? '#e0f2fe'
      : '#cce8ff';

  const dprRange: [number, number] =
    effectiveQuality === 'HIGH'
      ? [1, 1.75]
      : effectiveQuality === 'MEDIUM'
      ? [1, 1.25]
      : [1, 1];

  const currentFloor = Math.round(playerPosition[1] / 4.2);
  const currentRoomObj = ROOM_LAYOUTS.find((r) => r.id === playerRoomId);
  const currentLocationLabel =
    playerRoomId === 'outdoor_campus'
      ? 'Outdoor Business Campus Plaza'
      : currentRoomObj
      ? currentRoomObj.name
      : `Floor ${currentFloor} Central Corridor`;

  const selectedRoomObj = rooms.find((r) => r.id === selectedRoomId);

  const triggerNearbyInteraction = () => {
    if (!nearbyInteraction) return;
    if (nearbyInteraction.type === 'AGENT') {
      selectAgent(nearbyInteraction.id, false);
    } else if (nearbyInteraction.type === 'SCREEN') {
      setExpandedScreenRoomId(nearbyInteraction.roomId || nearbyInteraction.id);
    } else if (nearbyInteraction.type === 'MEETING') {
      setPresentationOpen(true);
    } else if (nearbyInteraction.type === 'ELEVATOR') {
      setElevatorModalOpen(true);
    }
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden" style={{ background: skyBg }}>
      <Canvas
        shadows={effectiveQuality !== 'LOW'}
        dpr={dprRange}
        gl={{
          antialias: effectiveQuality !== 'LOW',
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
      >
        <Suspense fallback={null}>
          <DevPerfSampler />

          {viewMode === 'DOLLHOUSE' ? (
            <WorldCamera />
          ) : (
            <>
              <PerspectiveCamera
                makeDefault
                position={[playerPosition[0], playerPosition[1] + 1.68, playerPosition[2]]}
                fov={62}
                near={0.15}
                far={240}
              />
              <FirstPersonController />
            </>
          )}

          <LightingRig />
          <Building />
          <NavigationController />

          {agents.map((agent) => (
            <Character key={agent.id} agent={agent} />
          ))}

          {/* Baked single-frame ContactShadows only on HIGH quality — Zero per-frame render target cost */}
          {effectiveQuality === 'HIGH' && (
            <ContactShadows
              position={[0, -0.02, 0]}
              frames={1}
              opacity={0.32}
              scale={58}
              blur={2.0}
              far={15}
            />
          )}
        </Suspense>
      </Canvas>

      {/* Developer Performance Telemetry Overlay (Hidden by default; toggle with Ctrl+Shift+P or Settings) */}
      <DevPerfOverlay />

      {/* DOLLHOUSE & ROOM INSPECTION FLOATING BAR */}
      {viewMode === 'DOLLHOUSE' && (
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-1.5 shadow-xl z-10">
          {selectedRoomObj ? (
            <>
              <button
                onClick={focusBuilding}
                className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Building</span>
              </button>

              <div className="h-4 w-px bg-slate-700 mx-1" />

              <div className="px-2 py-0.5 flex items-center gap-2">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">
                  F{selectedRoomObj.floor}
                </span>
                <span className="text-xs font-bold text-white">{selectedRoomObj.name}</span>
              </div>

              <div className="h-4 w-px bg-slate-700 mx-1" />

              {/* Room Inspection Mode Switcher: Architectural vs Interior */}
              <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                <button
                  onClick={() => focusRoom(selectedRoomObj.id, 'ARCHITECTURAL')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                    roomInspectionMode === 'ARCHITECTURAL'
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Architectural View
                </button>
                <button
                  onClick={() => enterInteriorView(selectedRoomObj.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition ${
                    roomInspectionMode === 'INTERIOR'
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  <span>Interior View</span>
                </button>
              </div>

              {selectedRoomObj.id !== 'boardroom' && (
                <button
                  onClick={() => setExpandedScreenRoomId(selectedRoomObj.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 flex items-center gap-1 transition"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Inspect Monitor</span>
                </button>
              )}

              <button
                onClick={() => enterWalkMode(selectedRoomObj.id)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1 transition"
              >
                <Footprints className="w-3.5 h-3.5" />
                <span>Walk Here</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => focusFloor(null)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  isolatedFloor === null
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                All Floors
              </button>
              {[
                { floor: 0, label: 'F0 • Ground' },
                { floor: 1, label: 'F1 • Engineering' },
                { floor: 2, label: 'F2 • QA & Ops' },
              ].map((item) => (
                <button
                  key={item.floor}
                  onClick={() => focusFloor(item.floor)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    isolatedFloor === item.floor
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}

              <div className="h-4 w-px bg-slate-700 mx-1" />

              <button
                onClick={() => focusRoom('ceo_office', 'ARCHITECTURAL')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium text-sky-300 hover:bg-sky-950/60 border border-sky-500/30 transition"
              >
                CEO Office
              </button>
              <button
                onClick={() => focusRoom('boardroom', 'ARCHITECTURAL')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium text-amber-300 hover:bg-amber-950/60 border border-amber-500/30 transition"
              >
                Main Boardroom
              </button>
              <button
                onClick={focusBuilding}
                className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 transition"
              >
                Reset Camera
              </button>

              <div className="h-4 w-px bg-slate-700 mx-1" />

              <button
                onClick={() => enterWalkMode()}
                className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 shadow-md transition"
              >
                <Footprints className="w-3.5 h-3.5" />
                <span>Walk Inside Office</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* FIRST-PERSON WALK MODE HUD OVERLAY */}
      {viewMode === 'WALK' && (
        <>
          {/* Center Crosshair Reticle */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
            <div className="relative flex items-center justify-center">
              <div
                className={`w-2.5 h-2.5 rounded-full border-2 transition-transform duration-150 ${
                  nearbyInteraction
                    ? 'border-amber-400 bg-amber-400/40 scale-125 shadow-[0_0_12px_rgba(251,191,36,0.9)]'
                    : 'border-white/80 bg-slate-900/30'
                }`}
              />
            </div>
          </div>

          {/* Top-Left Location & Floor Elevator Bar */}
          <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl px-3 py-2 shadow-xl z-10">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 font-bold">
                  FIRST-PERSON WALK MODE • FLOOR {currentFloor}
                </div>
                <div className="text-xs font-bold text-white">{currentLocationLabel}</div>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-700 mx-1" />

            {/* Instant Elevator Floor Buttons */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400 font-mono mr-1 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-sky-400" />
                Elevator:
              </span>
              {[0, 1, 2].map((fl) => (
                <button
                  key={fl}
                  onClick={() => {
                    soundEngine.playElevatorChime();
                    teleportPlayerToFloor(fl);
                  }}
                  className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition ${
                    currentFloor === fl
                      ? 'bg-sky-500 text-slate-950'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  F{fl}
                </button>
              ))}
            </div>

            <div className="h-6 w-px bg-slate-700 mx-1" />

            <button
              onClick={exitWalkMode}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Exit to Dollhouse</span>
            </button>
          </div>

          {/* Contextual [E] Interaction Prompt */}
          {nearbyInteraction && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20">
              <button
                onClick={triggerNearbyInteraction}
                className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-950/95 hover:bg-slate-900 border-2 border-amber-400/90 shadow-2xl text-left transition transform hover:scale-105"
              >
                <span className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-mono font-black text-sm flex items-center justify-center shadow">
                  E
                </span>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{nearbyInteraction.label}</span>
                    <Maximize2 className="w-3 h-3 text-amber-400" />
                  </div>
                  {nearbyInteraction.sublabel && (
                    <div className="text-[10px] text-slate-300 font-mono">
                      {nearbyInteraction.sublabel}
                    </div>
                  )}
                </div>
              </button>
            </div>
          )}

          {/* Bottom-Left Walk Controls Legend */}
          <div className="absolute bottom-3 left-3 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-300 flex flex-wrap items-center gap-3 z-10 shadow-lg">
            <span>
              <strong className="text-white font-mono">WASD</strong> Walk
            </span>
            <span>
              <strong className="text-white font-mono">Shift</strong> Sprint
            </span>
            <span>
              <strong className="text-white font-mono">Space</strong> Jump
            </span>
            <span>
              <strong className="text-white font-mono">Mouse / Drag</strong> Look
            </span>
            <span>
              <strong className="text-amber-300 font-mono">E</strong> Interact
            </span>
            <span>
              <strong className="text-white font-mono">Esc</strong> Release Cursor
            </span>
          </div>
        </>
      )}

      {/* GLASS ELEVATOR FLOOR SELECTOR MODAL */}
      {elevatorModalOpen && (
        <div
          onClick={() => setElevatorModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#0d131f] border border-slate-700 shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-white">
                  Panoramic Glass Elevator • Select Destination Floor
                </h3>
              </div>
              <button
                onClick={() => setElevatorModalOpen(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-2.5">
              {[
                {
                  floor: 2,
                  title: 'Floor 2 — Quality, Security & Operations',
                  desc: 'QA & Testing Lab, Security & Audit Room, DevOps Room, Operations Centre',
                },
                {
                  floor: 1,
                  title: 'Floor 1 — Architecture & Core Engineering',
                  desc: 'System Architecture Lab, Backend Engineering, Frontend Engineering',
                },
                {
                  floor: 0,
                  title: 'Floor 0 — Ground Executive & Campus Plaza',
                  desc: 'Reception & Lobby, CEO Office, Product Management, Main Boardroom & Outdoor Campus',
                },
              ].map((item) => (
                <button
                  key={item.floor}
                  onClick={() => {
                    soundEngine.playElevatorChime();
                    teleportPlayerToFloor(item.floor);
                  }}
                  className={`w-full p-3.5 rounded-xl border text-left transition flex items-center justify-between ${
                    currentFloor === item.floor
                      ? 'bg-sky-500/20 border-sky-400 text-white'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-600 text-slate-200'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-white">{item.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 font-mono text-xs font-bold text-sky-300 ml-3 shrink-0">
                    F{item.floor}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
