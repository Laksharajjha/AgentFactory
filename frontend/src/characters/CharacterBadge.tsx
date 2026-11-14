import React from 'react';
import { Html } from '@react-three/drei';
import { AgentProfile } from '../types/agent';
import { useWorldStore } from '../state/worldStore';

interface CharacterBadgeProps {
  agent: AgentProfile;
  isSelected: boolean;
  isSpeaking: boolean;
  isHovered: boolean;
  onSelect: () => void;
}

export const CharacterBadge: React.FC<CharacterBadgeProps> = React.memo(({
  agent,
  isSelected,
  isSpeaking,
  isHovered,
  onSelect,
}) => {
  const anyModalOpen = useWorldStore(
    (s) =>
      Boolean(
        s.presentationOpen ||
          s.factoryModalOpen ||
          s.settingsModalOpen ||
          s.expandedScreenRoomId ||
          s.elevatorModalOpen
      )
  );

  // Only show character tooltip on hover, selection, or when actively speaking in a meeting
  if (anyModalOpen || (!isHovered && !isSelected && !isSpeaking)) {
    return null;
  }

  const accent = agent.avatar_config?.accent_color || '#3b82f6';

  return (
    <Html
      position={[0, 2.08, 0]}
      center
      zIndexRange={[15, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={`pointer-events-auto cursor-pointer select-none rounded-full px-2.5 py-0.5 border shadow-lg flex items-center gap-1.5 whitespace-nowrap transition-transform ${
          isSpeaking
            ? 'bg-slate-950/95 border-sky-400 ring-2 ring-sky-400/30 scale-105'
            : isSelected
            ? 'bg-slate-950/95 border-amber-400 ring-2 ring-amber-400/30'
            : 'bg-slate-950/90 border-slate-700'
        }`}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: accent }}
        />
        <span className="text-[11px] font-bold text-white">{agent.name}</span>
        <span className="text-[10px] text-slate-300">• {agent.role}</span>
        {isSpeaking && (
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-sky-500 text-slate-950">
            SPEAKING
          </span>
        )}
      </div>
    </Html>
  );
});
