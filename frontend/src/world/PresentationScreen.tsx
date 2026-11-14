import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useMeetingStore } from '../state/meetingStore';
import { useWorldStore } from '../state/worldStore';
import { SHARED_MATERIALS } from './sharedMaterials';

interface PresentationScreenProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

let boardroomCanvas: HTMLCanvasElement | null = null;
let boardroomTexture: THREE.CanvasTexture | null = null;
let lastBoardroomHash = '';

function getBoardroomPresentationTexture(
  title: string,
  subtitle: string,
  presenter: string,
  presType: string,
  status: string,
  bodyLines: string[]
): THREE.CanvasTexture {
  const hash = `${title}|${subtitle}|${presenter}|${presType}|${status}|${bodyLines.join(';')}`;
  if (boardroomTexture && lastBoardroomHash === hash) {
    return boardroomTexture;
  }

  if (!boardroomCanvas) {
    boardroomCanvas = document.createElement('canvas');
    boardroomCanvas.width = 640;
    boardroomCanvas.height = 340;
  }

  const ctx = boardroomCanvas.getContext('2d');
  if (ctx) {
    const w = 640;
    const h = 340;
    ctx.fillStyle = '#09111f';
    ctx.fillRect(0, 0, w, h);

    // Top Header Bar
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, w, 42);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`BOARDROOM 4K PRESENTATION WALL // ${presType}`, 20, 26);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`STATUS: ${status}`, w - 165, 26);

    // Slide Title & Presenter
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(title.slice(0, 46), 24, 82);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(presenter, 24, 108);

    // Content Box
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(24, 124, w - 48, 168);
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 124, w - 48, 168);

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 13px monospace';
    bodyLines.slice(0, 5).forEach((line, idx) => {
      ctx.fillText(line.slice(0, 68), 40, 154 + idx * 28);
    });

    // Footer
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px monospace';
    ctx.fillText('CLICK SCREEN OR PRESS [E] TO OPEN INTERACTIVE PRESENTATION VIEWER', 24, 318);
  }

  lastBoardroomHash = hash;
  if (boardroomTexture) {
    boardroomTexture.needsUpdate = true;
    return boardroomTexture;
  }

  boardroomTexture = new THREE.CanvasTexture(boardroomCanvas);
  boardroomTexture.colorSpace = THREE.SRGBColorSpace;
  boardroomTexture.minFilter = THREE.LinearFilter;
  boardroomTexture.magFilter = THREE.LinearFilter;
  boardroomTexture.generateMipmaps = false;
  boardroomTexture.needsUpdate = true;
  return boardroomTexture;
}

export const PresentationScreen = React.memo<PresentationScreenProps>(({
  position,
  rotation = [0, -Math.PI / 2, 0],
}) => {
  const activePresentation = useWorldStore((s) => s.activePresentation);
  const activeMeeting = useWorldStore((s) => s.activeMeeting);
  const setExpandedPresentation = useMeetingStore((s) => s.setExpandedPresentation);
  const setSplitViewOpen = useMeetingStore((s) => s.setSplitViewOpen);

  const pres =
    activePresentation ||
    (activeMeeting?.presentations?.length
      ? activeMeeting.presentations[activeMeeting.presentations.length - 1]
      : null);

  const texture = useMemo(() => {
    if (pres) {
      const jsonPreview = JSON.stringify(pres.structured_data, null, 2)
        .split('\n')
        .filter((l) => l.trim().length > 1)
        .slice(0, 5);
      return getBoardroomPresentationTexture(
        pres.title,
        pres.subtitle || '',
        `Presenter: ${pres.presenter_name} (${pres.presenter_role})`,
        pres.presentation_type.replace(/_/g, ' '),
        activeMeeting?.status || 'PRESENTING',
        jsonPreview
      );
    }
    return getBoardroomPresentationTexture(
      activeMeeting ? activeMeeting.title : 'Executive Boardroom — Standby',
      '',
      activeMeeting
        ? `${activeMeeting.participants.length} Autonomous Agents Seated`
        : 'Ready for Multi-Agent Architecture & Sprint Reviews',
      'EXECUTIVE DISPLAY',
      activeMeeting?.status || 'READY',
      [
        '• Live 14-Step Autonomous Boardroom Engine Ready',
        '• Architecture Diagrams, Task Breakdowns & Risk Matrices',
        '• Click Screen or "Boardroom" in Top Bar to Observe Session',
      ]
    );
  }, [pres, activeMeeting]);

  return (
    <group
      position={position}
      rotation={rotation}
      onClick={(e) => {
        e.stopPropagation();
        if (pres) {
          setExpandedPresentation(pres);
        } else {
          setSplitViewOpen(true);
        }
      }}
    >
      {/* Matte architectural bezel */}
      <mesh material={SHARED_MATERIALS.monitorBezel}>
        <boxGeometry args={[4.4, 2.35, 0.1]} />
      </mesh>

      {/* Pure 3D CanvasTexture Presentation Surface (Never overlaps or blocks 3D characters!) */}
      <mesh position={[0, 0, 0.056]}>
        <planeGeometry args={[4.2, 2.15]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
});
