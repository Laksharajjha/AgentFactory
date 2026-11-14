import { useMemo } from 'react';
import { useWorldStore } from '../state/worldStore';

export function useAgentState() {
  const agents = useWorldStore((s) => s.agents);
  const selectedAgentId = useWorldStore((s) => s.selectedAgentId);
  const selectAgent = useWorldStore((s) => s.selectAgent);
  const sendAgentInstruction = useWorldStore((s) => s.sendAgentInstruction);
  const toggleAgentPause = useWorldStore((s) => s.toggleAgentPause);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) || null,
    [agents, selectedAgentId]
  );

  const activeCount = useMemo(
    () =>
      agents.filter((a) =>
        ['TASK_ASSIGNED', 'PLANNING', 'WORKING', 'MOVING', 'IN_MEETING', 'PRESENTING', 'NEEDS_COLLABORATION'].includes(
          a.state
        )
      ).length,
    [agents]
  );

  return {
    agents,
    selectedAgent,
    selectedAgentId,
    activeCount,
    selectAgent,
    sendAgentInstruction,
    toggleAgentPause,
  };
}
