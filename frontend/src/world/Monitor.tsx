import React, { useMemo } from 'react';
import { useWorldStore } from '../state/worldStore';
import { getOrUpdateScreenTexture } from './ScreenTextureRenderer';
import { SHARED_GEOMETRIES, SHARED_MATERIALS } from './sharedMaterials';

interface MonitorProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  screenColor?: string;
  dual?: boolean;
  roomId?: string;
}

export const Monitor = React.memo<MonitorProps>(({
  position = [0, 0.78, 0],
  rotation = [0, 0, 0],
  screenColor = '#0ea5e9',
  dual = false,
  roomId = 'backend_room',
}) => {
  const setExpandedScreenRoomId = useWorldStore((s) => s.setExpandedScreenRoomId);
  const effectiveQuality = useWorldStore((s) => s.effectiveQuality);

  // Narrow primitive selector so Monitor only re-renders when its specific room's display data changes
  const screenKey = useWorldStore((s) => {
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

  const screenTexture = useMemo(() => {
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
    ] = screenKey.split('|');

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
  }, [roomId, screenKey, effectiveQuality]);

  return (
    <group
      position={position}
      rotation={rotation}
      onClick={(e) => {
        e.stopPropagation();
        setExpandedScreenRoomId(roomId);
      }}
    >
      {/* Brushed aluminum stand base */}
      <mesh
        position={[0, 0.015, 0]}
        geometry={SHARED_GEOMETRIES.monitorBase}
        material={SHARED_MATERIALS.aluminumStand}
      />
      {/* Stand arm */}
      <mesh
        position={[0, 0.2, -0.05]}
        geometry={SHARED_GEOMETRIES.monitorArm}
        material={SHARED_MATERIALS.brushedSteel}
      />
      {dual ? (
        <>
          <group position={[-0.45, 0.42, 0.02]} rotation={[-0.06, 0.14, 0]}>
            <mesh
              geometry={SHARED_GEOMETRIES.monitorBezelDual}
              material={SHARED_MATERIALS.monitorBezel}
            />
            <mesh position={[0, 0, 0.017]} geometry={SHARED_GEOMETRIES.monitorScreenDual}>
              <meshBasicMaterial map={screenTexture} toneMapped={false} />
            </mesh>
          </group>
          <group position={[0.45, 0.42, 0.02]} rotation={[-0.06, -0.14, 0]}>
            <mesh
              geometry={SHARED_GEOMETRIES.monitorBezelDual}
              material={SHARED_MATERIALS.monitorBezel}
            />
            <mesh position={[0, 0, 0.017]} geometry={SHARED_GEOMETRIES.monitorScreenDual}>
              <meshBasicMaterial map={screenTexture} toneMapped={false} />
            </mesh>
          </group>
        </>
      ) : (
        <group position={[0, 0.42, 0]} rotation={[-0.06, 0, 0]}>
          <mesh
            geometry={SHARED_GEOMETRIES.monitorBezelSingle}
            material={SHARED_MATERIALS.monitorBezel}
          />
          <mesh position={[0, 0, 0.017]} geometry={SHARED_GEOMETRIES.monitorScreenSingle}>
            <meshBasicMaterial map={screenTexture} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.27, 0.018]}>
            <planeGeometry args={[0.96, 0.02]} />
            <meshBasicMaterial color={screenColor} />
          </mesh>
        </group>
      )}
    </group>
  );
});
