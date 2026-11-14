import React, { useMemo } from 'react';
import { useWorldStore } from '../state/worldStore';
import { ConferenceTable } from './ConferenceTable';
import { Desk } from './Desk';
import { Plant } from './Plant';
import { PresentationScreen } from './PresentationScreen';
import { getOrUpdateScreenTexture } from './ScreenTextureRenderer';
import { SHARED_MATERIALS } from './sharedMaterials';

interface WallBoardProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  height?: number;
  accentColor?: string;
  roomId: string;
}

const WallBoard = React.memo<WallBoardProps>(({
  position,
  rotation = [0, 0, 0],
  width = 3.2,
  height = 1.55,
  accentColor = '#38bdf8',
  roomId,
}) => {
  const setExpandedScreenRoomId = useWorldStore((s) => s.setExpandedScreenRoomId);
  const effectiveQuality = useWorldStore((s) => s.effectiveQuality);

  // Narrow primitive selector so WallBoard only updates when its room's data changes
  const boardKey = useWorldStore((s) => {
    const ag = s.agents.find((a) => a.current_room_id === roomId || a.home_room_id === roomId);
    const task = s.tasks.find(
      (t) => t.target_room_id === roomId || (ag && t.assigned_agent_id === ag.id)
    );
    const completed = s.tasks.filter((t) => t.status === 'COMPLETED').length;
    const isLive = Boolean(s.tokenUsage?.provider_status?.startsWith('LIVE GEMINI MODE'));
    return [
      ag?.name || '',
      ag?.state || 'IDLE',
      task?.title || '',
      task?.progress ?? 0,
      task?.status || '',
      s.tokenUsage?.total_tokens_used ?? 0,
      s.tokenUsage?.global_token_budget ?? 100000,
      completed,
      s.tasks.length || 6,
      s.ceoOverview?.company_health_score ?? 98,
      s.ceoOverview?.active_project?.name || '',
      isLive ? '1' : '0',
    ].join('|');
  });

  const texture = useMemo(() => {
    const [
      agentName,
      agentState,
      taskTitle,
      taskProgressStr,
      taskStatus,
      tokensUsedStr,
      tokenBudgetStr,
      completedStr,
      totalStr,
      healthStr,
      activeProjectName,
      isLiveStr,
    ] = boardKey.split('|');

    return getOrUpdateScreenTexture({
      roomId,
      agentName: agentName || undefined,
      agentState: agentState || undefined,
      taskTitle: taskTitle || undefined,
      taskProgress: Number(taskProgressStr),
      taskStatus: taskStatus || undefined,
      tokensUsed: Number(tokensUsedStr),
      tokenBudget: Number(tokenBudgetStr),
      completedTasksCount: Number(completedStr),
      totalTasksCount: Number(totalStr),
      healthScore: Number(healthStr),
      activeProjectName: activeProjectName || undefined,
      isLiveGemini: isLiveStr === '1',
      quality: effectiveQuality,
    });
  }, [roomId, boardKey, effectiveQuality]);

  return (
    <group
      position={position}
      rotation={rotation}
      onClick={(e) => {
        e.stopPropagation();
        setExpandedScreenRoomId(roomId);
      }}
    >
      <mesh material={SHARED_MATERIALS.monitorBezel}>
        <boxGeometry args={[width, height, 0.06]} />
      </mesh>
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[width - 0.12, height - 0.12]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, height / 2 - 0.03, 0.038]}>
        <planeGeometry args={[width - 0.12, 0.04]} />
        <meshBasicMaterial color={accentColor} />
      </mesh>
    </group>
  );
});

const Bookshelf = React.memo<{ position: [number, number, number]; rotation?: [number, number, number] }>(({
  position,
  rotation = [0, 0, 0],
}) => (
  <group position={position} rotation={rotation}>
    <mesh position={[0, 1.0, 0]} material={SHARED_MATERIALS.fasciaWood}>
      <boxGeometry args={[1.5, 2.0, 0.36]} />
    </mesh>
    {[0.45, 0.95, 1.45].map((sy, idx) => (
      <group key={idx} position={[0, sy, 0.04]}>
        <mesh position={[-0.38, 0, 0]}>
          <boxGeometry args={[0.38, 0.24, 0.24]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
        <mesh position={[0.08, 0, 0]}>
          <boxGeometry args={[0.32, 0.26, 0.24]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
        <mesh position={[0.42, 0, 0]}>
          <boxGeometry args={[0.26, 0.22, 0.24]} />
          <meshBasicMaterial color="#10b981" />
        </mesh>
      </group>
    ))}
  </group>
));

const CoffeeStation = React.memo<{ position: [number, number, number]; rotation?: [number, number, number] }>(({
  position,
  rotation = [0, 0, 0],
}) => (
  <group position={position} rotation={rotation}>
    <mesh position={[0, 0.45, 0]} material={SHARED_MATERIALS.whiteCounter}>
      <boxGeometry args={[1.6, 0.9, 0.65]} />
    </mesh>
    <mesh position={[0, 0.92, 0]} material={SHARED_MATERIALS.fasciaWood}>
      <boxGeometry args={[1.66, 0.05, 0.7]} />
    </mesh>
    <mesh position={[-0.35, 1.15, -0.05]} material={SHARED_MATERIALS.brushedSteel}>
      <boxGeometry args={[0.45, 0.42, 0.38]} />
    </mesh>
    <mesh position={[0.45, 1.18, -0.05]} material={SHARED_MATERIALS.balustradeGlass}>
      <cylinderGeometry args={[0.14, 0.14, 0.48, 10]} />
    </mesh>
  </group>
));

const AreaRug: React.FC<{
  position: [number, number, number];
  args: [number, number, number];
  color?: string;
}> = React.memo(({ position, args, color = '#e2e8f0' }) => (
  <mesh position={position} receiveShadow>
    <boxGeometry args={args} />
    <meshStandardMaterial color={color} roughness={0.92} />
  </mesh>
));

const ServerRack: React.FC<{ position: [number, number, number] }> = React.memo(({ position }) => (
  <group position={position}>
    <mesh position={[0, 1.05, 0]} material={SHARED_MATERIALS.darkSteel}>
      <boxGeometry args={[0.75, 2.1, 0.75]} />
    </mesh>
    {[-0.5, 0, 0.5].map((yOff, i) => (
      <mesh key={i} position={[0, 1.05 + yOff, 0.38]}>
        <planeGeometry args={[0.56, 0.05]} />
        <meshBasicMaterial color={i % 2 === 0 ? '#38bdf8' : '#10b981'} />
      </mesh>
    ))}
  </group>
));

interface RoomContentsProps {
  roomId: string;
}

export const RoomContents: React.FC<RoomContentsProps> = React.memo(({ roomId }) => {
  switch (roomId) {
    case 'reception':
      return (
        <group>
          {/* Warm oak & brushed steel reception desk */}
          <mesh position={[-8.6, 0.55, 4.2]} material={SHARED_MATERIALS.warmOak}>
            <boxGeometry args={[2.6, 1.1, 0.85]} />
          </mesh>
          <mesh position={[-8.6, 0.95, 4.55]} material={SHARED_MATERIALS.whiteCounter}>
            <boxGeometry args={[2.7, 0.35, 0.25]} />
          </mesh>
          <AreaRug position={[-6.6, 0.06, 5.2]} args={[3.2, 0.015, 2.6]} color="#cbd5e1" />
          <mesh position={[-6.6, 0.32, 5.8]} material={SHARED_MATERIALS.brushedSteel}>
            <boxGeometry args={[2.2, 0.45, 0.8]} />
          </mesh>
          <CoffeeStation position={[-10.8, 0, 6.2]} />
          {/* WallBoard facing South-East into Reception so it is clearly visible during Room Inspection */}
          <WallBoard
            position={[-8.5, 1.85, 1.55]}
            width={3.4}
            height={1.45}
            accentColor="#d97706"
            roomId="reception"
          />
          <Plant position={[-11.1, 0, 2.4]} scale={1.0} />
          <Plant position={[-5.7, 0, 6.6]} scale={0.9} />
        </group>
      );

    case 'ceo_office':
      return (
        <group>
          <AreaRug position={[-8.8, 0.06, -4.6]} args={[4.4, 0.015, 3.6]} color="#dbeafe" />
          {/* Executive Desk & Dual Monitors facing South (+Z) toward Alex's chair & inspection camera */}
          <Desk position={[-8.8, 0, -4.8]} executive screenColor="#3b82f6" roomId="ceo_office" />
          <WallBoard
            position={[-8.5, 1.95, -7.45]}
            width={3.8}
            height={1.55}
            accentColor="#3b82f6"
            roomId="ceo_office"
          />
          <Bookshelf position={[-11.35, 0, -4.5]} rotation={[0, Math.PI / 2, 0]} />
          <Plant position={[-11.1, 0, -6.8]} scale={1.0} />
          <Plant position={[-5.9, 0, -6.8]} scale={0.9} />
        </group>
      );

    case 'product_room':
      return (
        <group>
          <AreaRug position={[-1.5, 0.06, -4.6]} args={[3.8, 0.015, 3.2]} color="#d1fae5" />
          <Desk position={[-1.5, 0, -4.8]} screenColor="#10b981" roomId="product_room" />
          <WallBoard
            position={[-1.5, 1.95, -7.45]}
            width={3.6}
            height={1.55}
            accentColor="#10b981"
            roomId="product_room"
          />
          <Bookshelf position={[1.2, 0, -4.5]} rotation={[0, -Math.PI / 2, 0]} />
          <Plant position={[-4.1, 0, -6.8]} scale={0.9} />
        </group>
      );

    case 'boardroom':
      return (
        <group>
          <AreaRug position={[6.6, 0.06, 0]} args={[7.6, 0.015, 5.2]} color="#e2e8f0" />
          <ConferenceTable position={[6.6, 0, 0]} />
          <PresentationScreen position={[11.02, 1.85, 0]} rotation={[0, -Math.PI / 2, 0]} />
          <mesh position={[9.9, 0.58, -2.2]} material={SHARED_MATERIALS.brushedSteel}>
            <boxGeometry args={[0.55, 1.15, 0.55]} />
          </mesh>
          <CoffeeStation position={[6.6, 0, -6.8]} />
          <Plant position={[2.8, 0, -6.6]} scale={1.0} />
          <Plant position={[2.8, 0, 6.6]} scale={1.0} />
          <Plant position={[10.4, 0, -6.6]} scale={0.95} />
          <Plant position={[10.4, 0, 6.6]} scale={0.95} />
        </group>
      );

    case 'architecture_lab':
      return (
        <group>
          <AreaRug position={[-6.8, 4.26, -4.8]} args={[5.8, 0.015, 3.4]} color="#cffafe" />
          <Desk position={[-7.8, 4.2, -4.8]} executive screenColor="#06b6d4" roomId="architecture_lab" />
          <Desk position={[-4.6, 4.2, -4.8]} screenColor="#06b6d4" roomId="architecture_lab" />
          <WallBoard
            position={[-7.2, 6.15, -7.45]}
            width={4.4}
            height={1.55}
            accentColor="#06b6d4"
            roomId="architecture_lab"
          />
          <Bookshelf position={[-11.3, 4.2, -4.5]} rotation={[0, Math.PI / 2, 0]} />
          <Plant position={[-10.9, 4.2, -6.8]} scale={0.95} />
        </group>
      );

    case 'backend_room':
      return (
        <group>
          <Desk position={[4.6, 4.2, -4.8]} screenColor="#8b5cf6" roomId="backend_room" />
          <Desk position={[1.2, 4.2, -4.8]} screenColor="#8b5cf6" roomId="backend_room" />
          <Desk position={[8.0, 4.2, -4.8]} screenColor="#8b5cf6" roomId="backend_room" />
          <WallBoard
            position={[4.6, 6.15, -7.45]}
            width={5.0}
            height={1.55}
            accentColor="#8b5cf6"
            roomId="backend_room"
          />
          <ServerRack position={[10.4, 4.2, -6.4]} />
          <CoffeeStation position={[-1.0, 4.2, -6.6]} />
          <Plant position={[-1.4, 4.2, -3.2]} scale={0.9} />
        </group>
      );

    case 'frontend_room':
      return (
        <group>
          <AreaRug position={[4.6, 4.26, 4.4]} args={[8.8, 0.015, 3.2]} color="#fce7f3" />
          {/* Oriented facing +Z so monitors & wall board face directly toward the Room Inspection camera! */}
          <Desk position={[4.6, 4.2, 3.9]} screenColor="#ec4899" roomId="frontend_room" />
          <Desk position={[1.2, 4.2, 3.9]} screenColor="#ec4899" roomId="frontend_room" />
          <Desk position={[8.0, 4.2, 3.9]} screenColor="#ec4899" roomId="frontend_room" />
          <WallBoard
            position={[4.6, 6.15, 1.55]}
            width={4.8}
            height={1.55}
            accentColor="#ec4899"
            roomId="frontend_room"
          />
          <Bookshelf position={[10.8, 4.2, 4.5]} rotation={[0, -Math.PI / 2, 0]} />
          <Plant position={[10.4, 4.2, 6.7]} scale={0.95} />
        </group>
      );

    case 'qa_lab':
      return (
        <group>
          <Desk position={[-7.8, 8.4, -4.8]} screenColor="#14b8a6" roomId="qa_lab" />
          <Desk position={[-4.6, 8.4, -4.8]} screenColor="#14b8a6" roomId="qa_lab" />
          <WallBoard
            position={[-7.2, 10.35, -7.45]}
            width={4.4}
            height={1.55}
            accentColor="#14b8a6"
            roomId="qa_lab"
          />
          <Bookshelf position={[-11.3, 8.4, -4.5]} rotation={[0, Math.PI / 2, 0]} />
          <Plant position={[-10.9, 8.4, -6.8]} scale={0.95} />
        </group>
      );

    case 'security_room':
      return (
        <group>
          <Desk position={[4.6, 8.4, -4.8]} screenColor="#ef4444" roomId="security_room" />
          <Desk position={[1.2, 8.4, -4.8]} screenColor="#ef4444" roomId="security_room" />
          <WallBoard
            position={[4.6, 10.35, -7.45]}
            width={4.8}
            height={1.55}
            accentColor="#ef4444"
            roomId="security_room"
          />
          <ServerRack position={[10.2, 8.4, -6.4]} />
          <ServerRack position={[9.2, 8.4, -6.4]} />
        </group>
      );

    case 'devops_room':
      return (
        <group>
          {/* Oriented facing +Z so monitors & wall board face directly toward the Room Inspection camera! */}
          <Desk position={[-7.2, 8.4, 3.9]} screenColor="#f97316" roomId="devops_room" />
          <WallBoard
            position={[-7.2, 10.35, 1.55]}
            width={4.2}
            height={1.55}
            accentColor="#f97316"
            roomId="devops_room"
          />
          <ServerRack position={[-10.6, 8.4, 6.2]} />
          <CoffeeStation position={[-4.2, 8.4, 6.4]} />
        </group>
      );

    case 'ops_centre':
      return (
        <group>
          <AreaRug position={[6.2, 8.46, 4.4]} args={[6.4, 0.015, 3.2]} color="#dbeafe" />
          {/* Oriented facing +Z so monitors & wall board face directly toward the Room Inspection camera! */}
          <Desk position={[4.6, 8.4, 3.9]} executive screenColor="#3b82f6" roomId="ops_centre" />
          <Desk position={[8.0, 8.4, 3.9]} screenColor="#3b82f6" roomId="ops_centre" />
          <WallBoard
            position={[5.8, 10.35, 1.55]}
            width={5.0}
            height={1.55}
            accentColor="#3b82f6"
            roomId="ops_centre"
          />
          <Plant position={[10.4, 8.4, 6.8]} scale={1.0} />
        </group>
      );

    default:
      return null;
  }
});
