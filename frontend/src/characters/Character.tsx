import React from 'react';
import { AgentProfile } from '../types/agent';
import { CharacterController } from './CharacterController';

interface CharacterProps {
  agent: AgentProfile;
}

export const Character: React.FC<CharacterProps> = ({ agent }) => {
  return <CharacterController agent={agent} />;
};
