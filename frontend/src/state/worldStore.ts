import { create } from 'zustand';
import { API_BASE_URL } from '../config';
import { AgentProfile, AgentState } from '../types/agent';
import { WorldEvent } from '../types/event';
import { MeetingDecision, MeetingMessage, MeetingPresentation, MeetingSession } from '../types/meeting';
import { TaskItem } from '../types/task';
import {
  ArtifactItem,
  CeoOverview,
  ConnectedRepoItem,
  ExecutionItem,
  ProjectSummary,
  QueueItem,
  RoomDefinition,
  SystemCapacity,
  TokenUsageSummary,
  WorldSnapshot,
} from '../types/world';
import { useEventStore } from './eventStore';
import { useMeetingStore } from './meetingStore';

export type AppSection =
  | 'office'
  | 'projects'
  | 'workspaces'
  | 'github'
  | 'artifacts'
  | 'executions'
  | 'integrations'
  | 'settings'
  | 'admin';

export type LeftSidebarTab =
  | 'overview'
  | 'floors'
  | 'agents'
  | 'tasks'
  | 'meetings'
  | 'factory'
  | 'history';

export const DEFAULT_ROOMS: RoomDefinition[] = [
  {
    id: 'reception',
    name: 'Reception & Atrium',
    floor: 0,
    y: 0.0,
    bounds: { x: -8.5, z: 4.5, width: 6.6, depth: 6.2 },
    entry_point: [-6.5, 0.0, 1.2],
    workstation: [-8.5, 0.0, 4.5],
    accent_color: '#d97706',
    description: 'Main architectural reception desk, visitor waiting lounge and PROJECT FORGE branding.',
    displays: ['Welcome Monolith', 'Visitor Telemetry'],
  },
  {
    id: 'ceo_office',
    name: 'CEO Office (Command Centre)',
    floor: 0,
    y: 0.0,
    bounds: { x: -8.5, z: -4.5, width: 6.6, depth: 6.2 },
    entry_point: [-6.5, 0.0, -1.2],
    workstation: [-8.8, 0.0, -5.2],
    accent_color: '#3b82f6',
    description: 'Executive command centre housing Alex (Orchestrator), company health, risk matrix and workforce strategy.',
    displays: ['Company Health Matrix', 'Executive Risk Radar', 'Global Token Ledger'],
  },
  {
    id: 'product_room',
    name: 'Product Management Room',
    floor: 0,
    y: 0.0,
    bounds: { x: -1.5, z: -4.5, width: 6.4, depth: 6.2 },
    entry_point: [-1.5, 0.0, -1.2],
    workstation: [-1.5, 0.0, -5.0],
    accent_color: '#10b981',
    description: 'Product roadmap planning board, Kanban sprint display and requirements studio.',
    displays: ['Kanban Delivery Board', 'User Journey Map'],
  },
  {
    id: 'boardroom',
    name: 'Main Boardroom',
    floor: 0,
    y: 0.0,
    bounds: { x: 6.6, z: 0.0, width: 9.2, depth: 15.2 },
    entry_point: [2.2, 0.0, 0.0],
    workstation: [6.6, 0.0, 0.0],
    accent_color: '#f59e0b',
    description: 'Executive glass-walled boardroom with 8-seat walnut conference table and large interactive presentation wall.',
    displays: ['Main Presentation Wall', 'Live Meeting Status'],
    seats: [
      [4.5, 0.0, -1.6],
      [6.0, 0.0, -1.6],
      [7.5, 0.0, -1.6],
      [9.0, 0.0, -1.6],
      [4.5, 0.0, 1.6],
      [6.0, 0.0, 1.6],
      [7.5, 0.0, 1.6],
      [9.0, 0.0, 1.6],
    ],
    podium_point: [9.8, 0.0, 0.0],
  },
  {
    id: 'architecture_lab',
    name: 'System Architecture Lab',
    floor: 1,
    y: 4.2,
    bounds: { x: -7.2, z: -4.5, width: 9.0, depth: 6.2 },
    entry_point: [-5.0, 4.2, -1.2],
    workstation: [-7.5, 4.2, -5.0],
    accent_color: '#06b6d4',
    description: 'System topology blueprints, service boundary diagrams and technical architecture lab.',
    displays: ['Service Topology Graph', 'Dependency Matrix'],
  },
  {
    id: 'backend_room',
    name: 'Backend Engineering Room',
    floor: 1,
    y: 4.2,
    bounds: { x: 4.6, z: -4.5, width: 13.6, depth: 6.2 },
    entry_point: [3.5, 4.2, -1.2],
    workstation: [4.6, 4.2, -5.0],
    accent_color: '#8b5cf6',
    description: 'Distributed systems workstations, database schema monitors and API contract terminals.',
    displays: ['API Contract Inspector', 'Query Latency Profiler'],
  },
  {
    id: 'frontend_room',
    name: 'Frontend Engineering Room',
    floor: 1,
    y: 4.2,
    bounds: { x: 4.6, z: 4.5, width: 13.6, depth: 6.2 },
    entry_point: [3.5, 4.2, 1.2],
    workstation: [4.6, 4.2, 5.0],
    accent_color: '#ec4899',
    description: 'UI/UX engineering studio, Three.js viewport previews and component design systems.',
    displays: ['Component Tree Canvas', 'Frame Timing Monitor'],
  },
  {
    id: 'qa_lab',
    name: 'QA Laboratory',
    floor: 2,
    y: 8.4,
    bounds: { x: -7.2, z: -4.5, width: 9.0, depth: 6.2 },
    entry_point: [-5.0, 8.4, -1.2],
    workstation: [-7.5, 8.4, -5.0],
    accent_color: '#14b8a6',
    description: 'Automated regression suites, bug triage boards and quality verification matrix.',
    displays: ['Regression Test Matrix', 'Defect Triage Radar'],
  },
  {
    id: 'security_room',
    name: 'Security Room',
    floor: 2,
    y: 8.4,
    bounds: { x: 4.6, z: -4.5, width: 13.6, depth: 6.2 },
    entry_point: [3.5, 8.4, -1.2],
    workstation: [4.6, 8.4, -5.0],
    accent_color: '#ef4444',
    description: 'Threat surface modeling, static security audit monitors and CVE vulnerability boards.',
    displays: ['Zero-Trust Audit Wall', 'Vulnerability Heatmap'],
  },
  {
    id: 'devops_room',
    name: 'DevOps Room',
    floor: 2,
    y: 8.4,
    bounds: { x: -7.2, z: 4.5, width: 9.0, depth: 6.2 },
    entry_point: [-5.0, 8.4, 1.2],
    workstation: [-7.5, 8.4, 5.0],
    accent_color: '#f97316',
    description: 'CI/CD pipeline telemetry, container orchestration clusters and infrastructure health.',
    displays: ['Cluster Topology', 'Deployment Pipeline'],
  },
  {
    id: 'ops_centre',
    name: 'Operations Centre',
    floor: 2,
    y: 8.4,
    bounds: { x: 4.6, z: 4.5, width: 13.6, depth: 6.2 },
    entry_point: [3.5, 8.4, 1.2],
    workstation: [4.6, 8.4, 5.0],
    accent_color: '#3b82f6',
    description: 'Global autonomous workforce observability, token budget governance and SLA monitors.',
    displays: ['Workforce Telemetry Wall', 'Token Economics Ledger'],
  },
];

export interface RoomLayoutItem {
  id: string;
  name: string;
  floor: number;
  center: [number, number, number];
  size: [number, number];
}

export const ROOM_LAYOUTS: RoomLayoutItem[] = DEFAULT_ROOMS.map((r) => ({
  id: r.id,
  name: r.name,
  floor: r.floor,
  center: [r.bounds.x, r.y, r.bounds.z],
  size: [r.bounds.width, r.bounds.depth],
}));

interface CameraTarget {
  position: [number, number, number];
  lookAt: [number, number, number];
}

export type ViewMode = 'DOLLHOUSE' | 'WALK';
export type DaylightPreset = 'MORNING' | 'DAYTIME' | 'AFTERNOON';
export type QualityPreset = 'AUTO' | 'HIGH' | 'MEDIUM' | 'LOW';
export type EffectiveQuality = 'HIGH' | 'MEDIUM' | 'LOW';
export type RoomInspectionMode = 'ARCHITECTURAL' | 'INTERIOR';

export interface NearbyInteraction {
  type: 'AGENT' | 'SCREEN' | 'MEETING' | 'ELEVATOR';
  id: string;
  label: string;
  sublabel?: string;
  roomId?: string;
}

export interface AmbientOverride {
  targetPosition?: [number, number, number] | null;
  activityLabel?: string;
  activityText?: string;
  clip?: string;
  animation?:
    | 'Idle'
    | 'Walking'
    | 'Sitting'
    | 'Typing'
    | 'Talking'
    | 'Listening'
    | 'Presenting'
    | 'Thinking'
    | 'Reading'
    | 'Standing'
    | 'Celebrating';
}

export const INITIAL_FALLBACK_AGENTS: AgentProfile[] = [
  {
    id: 'agt_default_alex',
    workforce_id: '',
    agent_key: 'alex',
    name: 'Alex',
    role: 'Chief Executive / Orchestrator',
    department: 'Executive Leadership',
    personality: 'Decisive, strategic, analytical leader who synthesizes cross-functional trade-offs.',
    system_instructions: '',
    capabilities: ['workforce_orchestration', 'strategic_planning', 'risk_governance'],
    tools: ['risk_evaluator', 'dependency_mapper'],
    memory_enabled: true,
    state: 'IDLE',
    current_activity: 'Monitoring company health in CEO Office',
    current_room_id: 'ceo_office',
    home_room_id: 'ceo_office',
    position: [-8.8, 0.0, -5.2],
    avatar_config: {
      suit_color: '#1e3a5f',
      shirt_color: '#f8fafc',
      accent_color: '#3b82f6',
      hair_color: '#1c1917',
      skin_color: '#e5b899',
      hair_style: 'short_parted',
      badge: 'CEO',
    },
    max_iterations: 5,
    iterations_used: 0,
    token_budget: 20000,
    tokens_used: 0,
    tasks_completed: 0,
    tasks_failed: 0,
    meetings_attended: 0,
    state_changed_at: new Date().toISOString(),
    memories: [],
  },
  {
    id: 'agt_default_marcus',
    workforce_id: '',
    agent_key: 'marcus',
    name: 'Marcus',
    role: 'System Architect',
    department: 'Architecture',
    personality: 'Rigorous systems thinker focused on service boundaries and decoupling.',
    system_instructions: '',
    capabilities: ['system_architecture', 'boundary_decomposition'],
    tools: ['architecture_analyzer', 'dependency_mapper'],
    memory_enabled: true,
    state: 'IDLE',
    current_activity: 'Inspecting service topology blueprints',
    current_room_id: 'architecture_lab',
    home_room_id: 'architecture_lab',
    position: [-7.5, 4.2, -5.0],
    avatar_config: {
      suit_color: '#334155',
      shirt_color: '#e0f2fe',
      accent_color: '#06b6d4',
      hair_color: '#44403c',
      skin_color: '#d6a27e',
      hair_style: 'textured_crop',
      badge: 'ARCH',
    },
    max_iterations: 5,
    iterations_used: 0,
    token_budget: 18000,
    tokens_used: 0,
    tasks_completed: 0,
    tasks_failed: 0,
    meetings_attended: 0,
    state_changed_at: new Date().toISOString(),
    memories: [],
  },
  {
    id: 'agt_default_olivia',
    workforce_id: '',
    agent_key: 'olivia',
    name: 'Olivia',
    role: 'Product Manager',
    department: 'Product',
    personality: 'Outcome-driven strategist who prioritizes high-impact user value.',
    system_instructions: '',
    capabilities: ['requirements_engineering', 'roadmap_prioritization'],
    tools: ['risk_evaluator', 'code_inspector'],
    memory_enabled: true,
    state: 'IDLE',
    current_activity: 'Reviewing Kanban roadmap in Product Room',
    current_room_id: 'product_room',
    home_room_id: 'product_room',
    position: [-1.5, 0.0, -5.0],
    avatar_config: {
      suit_color: '#065f46',
      shirt_color: '#ecfdf5',
      accent_color: '#10b981',
      hair_color: '#451a03',
      skin_color: '#f1c6a7',
      hair_style: 'sleek_bob',
      badge: 'PM',
    },
    max_iterations: 5,
    iterations_used: 0,
    token_budget: 15000,
    tokens_used: 0,
    tasks_completed: 0,
    tasks_failed: 0,
    meetings_attended: 0,
    state_changed_at: new Date().toISOString(),
    memories: [],
  },
  {
    id: 'agt_default_sarah',
    workforce_id: '',
    agent_key: 'sarah',
    name: 'Sarah',
    role: 'Backend Engineer',
    department: 'Engineering',
    personality: 'Pragmatic backend specialist focused on API contracts and security hardening.',
    system_instructions: '',
    capabilities: ['code_analysis', 'api_design', 'security_hardening'],
    tools: ['code_inspector', 'security_scanner'],
    memory_enabled: true,
    state: 'IDLE',
    current_activity: 'Profiling API contracts in Backend Engineering',
    current_room_id: 'backend_room',
    home_room_id: 'backend_room',
    position: [4.6, 4.2, -5.0],
    avatar_config: {
      suit_color: '#4c1d95',
      shirt_color: '#f3e8ff',
      accent_color: '#8b5cf6',
      hair_color: '#18181b',
      skin_color: '#eab696',
      hair_style: 'bun',
      badge: 'BE',
    },
    max_iterations: 5,
    iterations_used: 0,
    token_budget: 16000,
    tokens_used: 0,
    tasks_completed: 0,
    tasks_failed: 0,
    meetings_attended: 0,
    state_changed_at: new Date().toISOString(),
    memories: [],
  },
  {
    id: 'agt_default_daniel',
    workforce_id: '',
    agent_key: 'daniel',
    name: 'Daniel',
    role: 'Frontend Engineer',
    department: 'Engineering',
    personality: 'Detail-oriented UI & state architecture engineer.',
    system_instructions: '',
    capabilities: ['ui_architecture', 'state_management'],
    tools: ['code_inspector', 'dependency_mapper'],
    memory_enabled: true,
    state: 'IDLE',
    current_activity: 'Inspecting UI component tree in Frontend Room',
    current_room_id: 'frontend_room',
    home_room_id: 'frontend_room',
    position: [4.6, 4.2, 5.0],
    avatar_config: {
      suit_color: '#831843',
      shirt_color: '#fdf2f8',
      accent_color: '#ec4899',
      hair_color: '#78350f',
      skin_color: '#f3cfb3',
      hair_style: 'modern_quiff',
      badge: 'FE',
    },
    max_iterations: 5,
    iterations_used: 0,
    token_budget: 15000,
    tokens_used: 0,
    tasks_completed: 0,
    tasks_failed: 0,
    meetings_attended: 0,
    state_changed_at: new Date().toISOString(),
    memories: [],
  },
  {
    id: 'agt_default_nina',
    workforce_id: '',
    agent_key: 'nina',
    name: 'Nina',
    role: 'QA Engineer',
    department: 'Quality & Security',
    personality: 'Skeptical quality guardian who demands reproducible regression baselines.',
    system_instructions: '',
    capabilities: ['regression_analysis', 'security_verification'],
    tools: ['test_coverage_estimator', 'security_scanner'],
    memory_enabled: true,
    state: 'IDLE',
    current_activity: 'Running regression test matrix in QA Lab',
    current_room_id: 'qa_lab',
    home_room_id: 'qa_lab',
    position: [-7.5, 8.4, -5.0],
    avatar_config: {
      suit_color: '#115e59',
      shirt_color: '#f0fdfa',
      accent_color: '#14b8a6',
      hair_color: '#27272a',
      skin_color: '#c68b59',
      hair_style: 'ponytail',
      badge: 'QA',
    },
    max_iterations: 5,
    iterations_used: 0,
    token_budget: 15000,
    tokens_used: 0,
    tasks_completed: 0,
    tasks_failed: 0,
    meetings_attended: 0,
    state_changed_at: new Date().toISOString(),
    memories: [],
  },
];

interface WorldStoreState {
  workforceId: string;
  workforceName: string;
  objective: string;
  workforceStatus: string;
  simulationSpeed: number;
  isPaused: boolean;
  projectSummary: ProjectSummary | null;
  finalReport: Record<string, unknown> | null;
  rooms: RoomDefinition[];
  agents: AgentProfile[];
  tasks: TaskItem[];
  meetings: MeetingSession[];
  activeMeeting: MeetingSession | null;
  activePresentation: MeetingPresentation | null;
  tokenUsage: TokenUsageSummary | null;
  ceoOverview: CeoOverview | null;
  artifacts: ArtifactItem[];
  executions: ExecutionItem[];
  queueItems: QueueItem[];
  connectedRepositories: ConnectedRepoItem[];
  systemCapacity: SystemCapacity | null;

  // Enterprise Shell & Multi-Tenant Auth State
  activeAppSection: AppSection;
  leftNavCollapsed: boolean;
  rightInspectorCollapsed: boolean;
  commandPaletteOpen: boolean;
  authModalOpen: boolean;
  authToken: string | null;
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
    platform_role: string;
  } | null;
  activeWorkspace: {
    id: string;
    tenant_id: string;
    name: string;
    slug: string;
    role?: string;
  } | null;

  githubStatus: 'NOT_CONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
  githubInstallation: {
    id: string;
    installation_id: string;
    account_login: string;
    account_type: string;
    permissions: Record<string, string>;
    status: string;
    token_expires_at?: string | null;
  } | null;
  githubError: string | null;
  githubInstallUrl: string | null;
  githubOAuthConfigured: boolean;

  viewMode: ViewMode;
  daylightPreset: DaylightPreset;
  qualityPreset: QualityPreset;
  effectiveQuality: EffectiveQuality;
  devPerfOpen: boolean;
  roomInspectionMode: RoomInspectionMode;
  playerPosition: [number, number, number];
  playerRoomId: string | null;
  nearbyInteraction: NearbyInteraction | null;
  expandedScreenRoomId: string | null;
  elevatorModalOpen: boolean;
  ambientOverrides: Record<string, AmbientOverride>;
  audioMuted: boolean;

  selectedAgentId: string | null;
  selectedRoomId: string | null;
  selectedTaskId: string | null;
  isolatedFloor: number | null;
  activeLeftTab: LeftSidebarTab;
  cameraTarget: CameraTarget | null;
  factoryModalOpen: boolean;
  settingsModalOpen: boolean;
  presentationOpen: boolean;
  isDeploying: boolean;

  setSnapshot: (snapshot: WorldSnapshot) => void;
  applyWorldEvent: (event: WorldEvent) => void;
  selectAgent: (agentId: string | null, focusCamera?: boolean) => void;
  selectRoom: (roomId: string | null, focusCamera?: boolean) => void;
  selectTask: (taskId: string | null) => void;
  setIsolatedFloor: (floor: number | null) => void;
  setActiveLeftTab: (tab: LeftSidebarTab) => void;
  setCameraTarget: (target: CameraTarget | null) => void;

  // Centralized Camera Management Architecture
  focusBuilding: () => void;
  focusFloor: (floorId: number | null) => void;
  focusRoom: (roomId: string, mode?: RoomInspectionMode) => void;
  focusCharacter: (agentId: string) => void;
  enterInteriorView: (roomId: string) => void;
  enterWalkMode: (spawnRoomId?: string) => void;
  exitWalkMode: () => void;
  resetCamera: () => void;

  setFactoryModalOpen: (open: boolean) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setPresentationOpen: (open: boolean) => void;

  setViewMode: (mode: ViewMode) => void;
  setDaylightPreset: (preset: DaylightPreset) => void;
  setQualityPreset: (preset: QualityPreset) => void;
  setEffectiveQuality: (quality: EffectiveQuality) => void;
  setDevPerfOpen: (open: boolean) => void;
  setRoomInspectionMode: (mode: RoomInspectionMode) => void;
  setPlayerPosition: (pos: [number, number, number], roomId?: string | null) => void;
  teleportPlayerToFloor: (floorIndex: number) => void;
  setNearbyInteraction: (interaction: NearbyInteraction | null) => void;
  setExpandedScreenRoomId: (roomId: string | null) => void;
  setElevatorModalOpen: (open: boolean) => void;
  setAmbientOverride: (agentId: string, override: AmbientOverride) => void;
  setAudioMuted: (muted: boolean) => void;

  setActiveAppSection: (section: AppSection) => void;
  setLeftNavCollapsed: (collapsed: boolean) => void;
  setRightInspectorCollapsed: (collapsed: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setAuthModalOpen: (open: boolean) => void;
  setAuthSession: (
    token: string,
    user: { id: string; name: string; email: string; role: string; platform_role: string },
    workspace: { id: string; tenant_id: string; name: string; slug: string }
  ) => void;
  clearAuthSession: (openModal?: boolean) => void;
  hydrateAuthSession: () => Promise<boolean>;
  switchWorkspace: (workspace: { id: string; tenant_id: string; name: string; slug: string; role?: string }) => Promise<void>;
  logoutSession: () => Promise<void>;
  createArtifact: (artifactType: string, title: string, structuredContent?: Record<string, unknown>) => Promise<ArtifactItem | null>;
  fetchGitHubStatus: () => Promise<void>;
  connectGitHub: (accountLogin?: string) => Promise<{ ok: boolean; error?: string }>;
  startGitHubOAuth: (mode?: 'install' | 'oauth') => Promise<void>;
  completeGitHubOAuth: (
    code: string,
    state: string,
    installationId?: string | null
  ) => Promise<{ ok: boolean; error?: string }>;
  setGitHubError: (error: string | null) => void;
  syncGitHubRepos: () => Promise<void>;
  syncRepoPulls: (repoId: string) => Promise<void>;
  disconnectGitHub: () => Promise<void>;
  executeRepoBranch: (repoId: string, branchName: string, filePath?: string) => Promise<{ ok: boolean; error?: string }>;
  decideApproval: (
    executionId: string,
    approvalId: string,
    decision: 'APPROVED' | 'REJECTED'
  ) => Promise<{ ok: boolean; error?: string; pullRequest?: Record<string, unknown> | null }>;
  cancelExecution: (executionId: string) => Promise<void>;
  updateAdminGovernor: (config: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;

  fetchSnapshot: (workforceId?: string) => Promise<void>;
  deployWorkforce: (name: string, objective: string, projectContext?: ProjectSummary | null) => Promise<void>;
  triggerBoardroomMeeting: () => Promise<void>;
  sendAgentInstruction: (agentId: string, instruction: string, assignAsTask?: boolean) => Promise<void>;
  toggleAgentPause: (agent: AgentProfile) => Promise<void>;
  setSimulationControl: (speed?: number, isPaused?: boolean) => Promise<void>;
}

const getStoredAuthToken = (): string | null => {
  if (typeof localStorage === 'undefined') return null;
  const token = localStorage.getItem('forge_auth_token');
  return token && token.trim() ? token : null;
};

const initialAuthToken = getStoredAuthToken();

export const useWorldStore = create<WorldStoreState>((set, get) => ({
  workforceId: '',
  workforceName: 'Project Forge Core Engineering',
  objective: 'Standby in virtual headquarters. Submit a software project objective or ZIP archive to dispatch the autonomous workforce.',
  workforceStatus: 'READY',
  simulationSpeed: 1.0,
  isPaused: false,
  projectSummary: null,
  finalReport: null,
  rooms: DEFAULT_ROOMS,
  agents: INITIAL_FALLBACK_AGENTS,
  tasks: [],
  meetings: [],
  activeMeeting: null,
  activePresentation: null,
  tokenUsage: null,
  ceoOverview: null,
  artifacts: [],
  executions: [],
  queueItems: [],
  connectedRepositories: [],
  systemCapacity: null,

  activeAppSection: 'office',
  leftNavCollapsed: false,
  rightInspectorCollapsed: false,
  commandPaletteOpen: false,
  authModalOpen: !initialAuthToken,
  authToken: initialAuthToken,
  currentUser: null,
  activeWorkspace: null,

  viewMode: 'DOLLHOUSE',
  daylightPreset: 'DAYTIME',
  qualityPreset: 'AUTO',
  effectiveQuality: 'HIGH',
  devPerfOpen: false,
  roomInspectionMode: 'ARCHITECTURAL',
  playerPosition: [-3.5, 0.0, 0.0],
  playerRoomId: 'reception',
  nearbyInteraction: null,
  expandedScreenRoomId: null,
  elevatorModalOpen: false,
  ambientOverrides: {},
  audioMuted: true,

  selectedAgentId: null,
  selectedRoomId: null,
  selectedTaskId: null,
  isolatedFloor: null,
  activeLeftTab: 'overview',
  cameraTarget: null,
  factoryModalOpen: false,
  settingsModalOpen: false,
  presentationOpen: false,
  isDeploying: false,
  githubStatus: 'NOT_CONNECTED',
  githubInstallation: null,
  githubError: null,
  githubInstallUrl: null,
  githubOAuthConfigured: false,

  setSnapshot: (snapshot) => {
    useEventStore.getState().setEvents(snapshot.recent_events || []);
    const hasLiveMeeting =
      snapshot.active_meeting &&
      ['GATHERING', 'ACTIVE', 'PRESENTING'].includes(snapshot.active_meeting.status);
    if (hasLiveMeeting) {
      useMeetingStore.getState().setSplitViewOpen(true);
    }
    set({
      workforceId: snapshot.workforce_id,
      workforceName: snapshot.workforce_name,
      objective: snapshot.objective,
      workforceStatus: snapshot.workforce_status,
      simulationSpeed: snapshot.simulation_speed,
      isPaused: snapshot.is_paused,
      projectSummary: snapshot.project_summary || null,
      finalReport: snapshot.final_report || null,
      rooms: snapshot.rooms?.length ? snapshot.rooms : DEFAULT_ROOMS,
      agents: snapshot.agents?.length ? snapshot.agents : INITIAL_FALLBACK_AGENTS,
      tasks: snapshot.tasks || [],
      meetings: snapshot.meetings || [],
      activeMeeting: snapshot.active_meeting || null,
      activePresentation: snapshot.active_presentation || null,
      tokenUsage: snapshot.token_usage || null,
      ceoOverview: snapshot.ceo_overview || null,
      artifacts: snapshot.artifacts || [],
      executions: snapshot.executions || [],
      queueItems: snapshot.queue_items || [],
      connectedRepositories: snapshot.connected_repositories || [],
      systemCapacity: snapshot.system_capacity || null,
    });
  },

  applyWorldEvent: (event) => {
    useEventStore.getState().addEvent(event);
    const { event_type, payload } = event;

    if (event_type === 'AGENT_STATE_CHANGED') {
      const agentId = String(payload.agent_id || event.entity_id);
      set((state) => ({
        agents: state.agents.map((a) =>
          a.id === agentId
            ? {
                ...a,
                state: (payload.new_state as AgentState) || a.state,
                current_activity: String(payload.current_activity || a.current_activity),
                recent_error: (payload.recent_error as string | null) ?? a.recent_error,
                state_changed_at: event.timestamp,
              }
            : a
        ),
      }));
    } else if (event_type === 'AGENT_MOVEMENT_REQUESTED') {
      const agentId = String(payload.agent_id || event.entity_id);
      const targetPos = payload.target_position as [number, number, number] | undefined;
      const toRoomId = String(payload.to_room_id || '');
      set((state) => ({
        agents: state.agents.map((a) =>
          a.id === agentId
            ? {
                ...a,
                state: 'MOVING',
                target_room_id: toRoomId || a.target_room_id,
                target_position: targetPos || a.target_position,
                current_activity: String(payload.activity || a.current_activity),
              }
            : a
        ),
      }));
    } else if (event_type === 'AGENT_LOCATION_CHANGED') {
      const agentId = String(payload.agent_id || event.entity_id);
      const pos = payload.position as [number, number, number] | undefined;
      const roomId = String(payload.room_id || '');
      set((state) => ({
        agents: state.agents.map((a) =>
          a.id === agentId
            ? {
                ...a,
                current_room_id: roomId || a.current_room_id,
                position: pos || a.position,
                target_room_id: null,
                target_position: null,
              }
            : a
        ),
      }));
    } else if (event_type === 'TASK_CREATED') {
      const taskId = String(payload.task_id || event.entity_id);
      set((state) => {
        if (state.tasks.some((t) => t.id === taskId)) return state;
        const newTask: TaskItem = {
          id: taskId,
          workforce_id: event.workforce_id,
          title: String(payload.title || 'New Task'),
          description: String(payload.description || ''),
          assigned_agent_id: (payload.assigned_agent_id as string) || null,
          assigned_agent_name: (payload.assigned_agent_name as string) || null,
          priority: String(payload.priority || 'HIGH'),
          status: String(payload.status || 'PENDING'),
          progress: 0,
          target_room_id: (payload.target_room_id as string) || null,
          dependencies: [],
          deliverables: (payload.deliverables as string[]) || [],
          execution_history: [],
          created_at: event.timestamp,
        };
        return { tasks: [...state.tasks, newTask] };
      });
    } else if (event_type === 'AGENT_TASK_ASSIGNED' || event_type === 'AGENT_WORK_STARTED') {
      const taskId = String(payload.task_id || '');
      const agentId = String(payload.agent_id || event.entity_id);
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'IN_PROGRESS',
                progress: event_type === 'AGENT_WORK_STARTED' ? 60 : 25,
              }
            : t
        ),
        agents: state.agents.map((a) =>
          a.id === agentId ? { ...a, current_task_id: taskId } : a
        ),
      }));
    } else if (event_type === 'TASK_COMPLETED') {
      const taskId = String(payload.task_id || event.entity_id);
      const agentId = String(payload.assigned_agent_id || '');
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'COMPLETED',
                progress: 100,
                result_summary: String(payload.result_summary || t.result_summary || ''),
                structured_output: (payload.structured_output as Record<string, unknown>) || t.structured_output,
                completed_at: event.timestamp,
              }
            : t
        ),
        agents: state.agents.map((a) =>
          a.id === agentId ? { ...a, tasks_completed: a.tasks_completed + 1 } : a
        ),
      }));
    } else if (event_type === 'TASK_FAILED') {
      const taskId = String(payload.task_id || event.entity_id);
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId ? { ...t, status: 'FAILED' } : t
        ),
      }));
    } else if (event_type === 'MEETING_REQUESTED' || event_type === 'MEETING_STARTED') {
      const meetingId = String(payload.meeting_id || event.entity_id);
      useMeetingStore.getState().setSplitViewOpen(true);
      set((state) => {
        const existing = state.meetings.find((m) => m.id === meetingId);
        if (existing) {
          const updated: MeetingSession = {
            ...existing,
            status: event_type === 'MEETING_STARTED' ? 'ACTIVE' : 'GATHERING',
            started_at: (payload.started_at as string) || existing.started_at,
          };
          return {
            meetings: state.meetings.map((m) => (m.id === meetingId ? updated : m)),
            activeMeeting: updated,
          };
        }
        const created: MeetingSession = {
          id: meetingId,
          workforce_id: event.workforce_id,
          title: String(payload.title || 'Boardroom Session'),
          agenda: (payload.agenda as string[]) || [],
          room_id: String(payload.room_id || 'boardroom'),
          initiator_agent_id: String(payload.initiator_id || ''),
          status: event_type === 'MEETING_STARTED' ? 'ACTIVE' : 'GATHERING',
          is_observed: true,
          participants: [],
          messages: [],
          presentations: [],
          decisions: [],
          created_at: event.timestamp,
        };
        return {
          meetings: [created, ...state.meetings],
          activeMeeting: created,
        };
      });
    } else if (event_type === 'MEETING_PARTICIPANT_JOINED') {
      const meetingId = String(payload.meeting_id || event.entity_id);
      const part = {
        agent_id: String(payload.agent_id || ''),
        agent_name: String(payload.agent_name || ''),
        agent_role: String(payload.agent_role || ''),
        seat_index: Number(payload.seat_index || 0),
        seat_position: (payload.seat_position as [number, number, number]) || [6.0, 0, 0],
        joined_at: event.timestamp,
      };
      set((state) => {
        const updateMtg = (m: MeetingSession): MeetingSession => {
          if (m.id !== meetingId) return m;
          const exists = m.participants.some((p) => p.agent_id === part.agent_id);
          return {
            ...m,
            participants: exists ? m.participants : [...m.participants, part],
          };
        };
        const updatedList = state.meetings.map(updateMtg);
        const active = state.activeMeeting?.id === meetingId ? updateMtg(state.activeMeeting) : state.activeMeeting;
        return { meetings: updatedList, activeMeeting: active };
      });
    } else if (event_type === 'MEETING_MESSAGE_CREATED') {
      const meetingId = String(payload.meeting_id || event.entity_id);
      const msg: MeetingMessage = {
        id: String(payload.id || event.event_id),
        meeting_id: meetingId,
        sender_agent_id: String(payload.sender_agent_id || ''),
        sender_name: String(payload.sender_name || ''),
        sender_role: String(payload.sender_role || ''),
        message_type: String(payload.message_type || 'DISCUSSION'),
        content: String(payload.content || ''),
        round_number: Number(payload.round_number || 1),
        created_at: String(payload.created_at || event.timestamp),
      };
      set((state) => {
        const updateMtg = (m: MeetingSession): MeetingSession => {
          if (m.id !== meetingId) return m;
          if (m.messages.some((x) => x.id === msg.id)) return m;
          return {
            ...m,
            active_speaker_id: msg.sender_agent_id,
            messages: [...m.messages, msg],
          };
        };
        return {
          meetings: state.meetings.map(updateMtg),
          activeMeeting: state.activeMeeting?.id === meetingId ? updateMtg(state.activeMeeting) : state.activeMeeting,
        };
      });
    } else if (event_type === 'MEETING_PRESENTATION_UPDATED') {
      const meetingId = String(payload.meeting_id || event.entity_id);
      const pres: MeetingPresentation = {
        id: String(payload.presentation_id || event.event_id),
        meeting_id: meetingId,
        presenter_agent_id: String(payload.presenter_agent_id || ''),
        presenter_name: String(payload.presenter_name || ''),
        presenter_role: String(payload.presenter_role || ''),
        presentation_type: (payload.presentation_type as MeetingPresentation['presentation_type']) || 'ARCHITECTURE_DIAGRAM',
        title: String(payload.title || 'Technical Presentation'),
        subtitle: (payload.subtitle as string) || null,
        structured_data: (payload.structured_data as Record<string, unknown>) || {},
        created_at: String(payload.created_at || event.timestamp),
      };
      set((state) => {
        const updateMtg = (m: MeetingSession): MeetingSession => {
          if (m.id !== meetingId) return m;
          return {
            ...m,
            status: 'PRESENTING',
            active_speaker_id: pres.presenter_agent_id,
            active_presentation_id: pres.id,
            presentations: [...m.presentations.filter((p) => p.id !== pres.id), pres],
          };
        };
        return {
          meetings: state.meetings.map(updateMtg),
          activeMeeting: state.activeMeeting?.id === meetingId ? updateMtg(state.activeMeeting) : state.activeMeeting,
          activePresentation: pres,
        };
      });
      if (get().viewMode === 'DOLLHOUSE') {
        get().focusRoom('boardroom', 'ARCHITECTURAL');
      }
    } else if (event_type === 'MEETING_DECISION_CREATED') {
      const meetingId = String(payload.meeting_id || event.entity_id);
      const dec: MeetingDecision = {
        id: String(payload.id || event.event_id),
        meeting_id: meetingId,
        title: String(payload.title || ''),
        rationale: String(payload.rationale || ''),
        owner_agent_id: (payload.owner_agent_id as string) || null,
        owner_name: (payload.owner_name as string) || null,
        action_items: (payload.action_items as string[]) || [],
        created_at: String(payload.created_at || event.timestamp),
      };
      set((state) => {
        const updateMtg = (m: MeetingSession): MeetingSession => {
          if (m.id !== meetingId) return m;
          if (m.decisions.some((d) => d.id === dec.id)) return m;
          return { ...m, decisions: [...m.decisions, dec] };
        };
        return {
          meetings: state.meetings.map(updateMtg),
          activeMeeting: state.activeMeeting?.id === meetingId ? updateMtg(state.activeMeeting) : state.activeMeeting,
        };
      });
    } else if (event_type === 'MEETING_ENDED') {
      const meetingId = String(payload.meeting_id || event.entity_id);
      set((state) => {
        const updateMtg = (m: MeetingSession): MeetingSession =>
          m.id === meetingId
            ? { ...m, status: 'COMPLETED', active_speaker_id: null, ended_at: event.timestamp }
            : m;
        return {
          meetings: state.meetings.map(updateMtg),
          activeMeeting: state.activeMeeting?.id === meetingId ? updateMtg(state.activeMeeting) : state.activeMeeting,
        };
      });
    } else if (event_type === 'TOKEN_USAGE_UPDATED') {
      const agentId = String(payload.agent_id || '');
      const addTokens = Number(payload.total_tokens || 0);
      set((state) => ({
        agents: state.agents.map((a) =>
          a.id === agentId ? { ...a, tokens_used: a.tokens_used + addTokens } : a
        ),
        tokenUsage: state.tokenUsage
          ? {
              ...state.tokenUsage,
              total_tokens_used: Number(payload.workforce_tokens_used || state.tokenUsage.total_tokens_used + addTokens),
              llm_calls_made: Number(payload.workforce_calls_made || state.tokenUsage.llm_calls_made + 1),
            }
          : state.tokenUsage,
      }));
    } else if (event_type === 'WORKFORCE_COMPLETED') {
      set({
        workforceStatus: 'COMPLETED',
        finalReport: (payload.final_report as Record<string, unknown>) || null,
      });
      void get().fetchSnapshot(event.workforce_id);
    } else if (
      event_type === 'EXECUTION_QUEUED' ||
      event_type === 'EXECUTION_ADMITTED' ||
      event_type === 'EXECUTION_STARTED' ||
      event_type === 'EXECUTION_COMPLETED' ||
      event_type === 'EXECUTION_FAILED' ||
      event_type === 'EXECUTION_CANCELLED' ||
      event_type === 'QUEUE_POSITION_UPDATED' ||
      event_type === 'CAPACITY_CHANGED' ||
      event_type === 'ARTIFACT_GENERATED'
    ) {
      void get().fetchSnapshot(event.workforce_id);
    }
  },

  selectAgent: (agentId, focusCamera = true) => {
    const state = get();
    if (!agentId) {
      set({ selectedAgentId: null });
      return;
    }
    if (focusCamera) {
      get().focusCharacter(agentId);
      return;
    }
    const agent = state.agents.find((a) => a.id === agentId);
    set({
      selectedAgentId: agentId,
      selectedRoomId: agent ? agent.current_room_id : state.selectedRoomId,
    });
  },

  selectRoom: (roomId, focusCamera = true) => {
    if (!roomId) {
      set({ selectedRoomId: null });
      return;
    }
    if (focusCamera) {
      get().focusRoom(roomId, 'ARCHITECTURAL');
      return;
    }
    set({ selectedRoomId: roomId, selectedAgentId: null });
  },

  selectTask: (taskId) => set({ selectedTaskId: taskId }),

  setIsolatedFloor: (floor) => {
    get().focusFloor(floor);
  },

  setActiveLeftTab: (activeLeftTab) => set({ activeLeftTab }),

  setCameraTarget: (cameraTarget) => set({ cameraTarget }),

  focusBuilding: () => {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    set({
      viewMode: 'DOLLHOUSE',
      isolatedFloor: null,
      selectedAgentId: null,
      selectedRoomId: null,
      roomInspectionMode: 'ARCHITECTURAL',
      cameraTarget: {
        position: [22, 19, 22],
        lookAt: [0, 4.2, 0],
      },
    });
  },

  focusFloor: (floor) => {
    if (floor === null) {
      get().focusBuilding();
      return;
    }
    const y = floor * 4.2;
    set({
      viewMode: 'DOLLHOUSE',
      isolatedFloor: floor,
      selectedRoomId: null,
      selectedAgentId: null,
      cameraTarget: {
        position: [15, y + 12.5, 16.5],
        lookAt: [0, y + 1.0, 0],
      },
    });
  },

  focusRoom: (roomId, mode = 'ARCHITECTURAL') => {
    const state = get();
    const room = state.rooms.find((r) => r.id === roomId);
    if (!room) {
      set({ selectedRoomId: roomId });
      return;
    }
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    const { x, z, width, depth } = room.bounds;
    const y = room.y;

    let camPos: [number, number, number];
    let lookAtPos: [number, number, number];

    if (mode === 'INTERIOR') {
      if (room.id === 'boardroom') {
        camPos = [x - 2.5, y + 2.15, z + 3.4];
        lookAtPos = [x + 1.8, y + 1.25, z - 0.3];
      } else {
        camPos = [x + width * 0.16, y + 2.15, z + depth * 0.36];
        lookAtPos = [x - 0.15, y + 1.15, z - depth * 0.25];
      }
    } else {
      // ARCHITECTURAL INSPECTION: Elevated three-quarter cutaway view with isolated floor
      if (room.id === 'boardroom') {
        camPos = [x - 4.4, y + 6.2, z + 7.2];
        lookAtPos = [x + 0.8, y + 1.15, z - 0.3];
      } else {
        camPos = [
          x + Math.min(3.6, width * 0.28),
          y + Math.max(4.6, Math.min(6.4, width * 0.48)),
          z + depth * 0.92,
        ];
        lookAtPos = [x - 0.15, y + 1.05, z - depth * 0.12];
      }
    }

    set({
      viewMode: 'DOLLHOUSE',
      selectedRoomId: roomId,
      selectedAgentId: null,
      isolatedFloor: room.floor,
      roomInspectionMode: mode,
      cameraTarget: {
        position: camPos,
        lookAt: lookAtPos,
      },
    });
  },

  focusCharacter: (agentId) => {
    const state = get();
    const agent = state.agents.find((a) => a.id === agentId);
    if (!agent) {
      set({ selectedAgentId: agentId });
      return;
    }
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    const [ax, ay, az] = agent.target_position || agent.position;
    const floorIdx = Math.round(ay / 4.2);
    set({
      viewMode: 'DOLLHOUSE',
      selectedAgentId: agentId,
      selectedRoomId: agent.current_room_id,
      isolatedFloor: floorIdx,
      cameraTarget: {
        position: [ax + 3.8, ay + 3.6, az + 4.4],
        lookAt: [ax, ay + 1.1, az],
      },
    });
  },

  enterInteriorView: (roomId) => {
    get().focusRoom(roomId, 'INTERIOR');
  },

  enterWalkMode: (spawnRoomId) => {
    const state = get();
    const targetRoomId = spawnRoomId || state.selectedRoomId;
    const selRoom = state.rooms.find((r) => r.id === targetRoomId);
    const startPos: [number, number, number] = selRoom
      ? [selRoom.entry_point[0], selRoom.y, selRoom.entry_point[2]]
      : state.playerPosition;
    set({
      viewMode: 'WALK',
      isolatedFloor: null,
      playerPosition: startPos,
      playerRoomId: selRoom ? selRoom.id : state.playerRoomId,
    });
  },

  exitWalkMode: () => {
    get().focusBuilding();
  },

  resetCamera: () => {
    get().focusBuilding();
  },

  setFactoryModalOpen: (factoryModalOpen) => set({ factoryModalOpen }),
  setSettingsModalOpen: (settingsModalOpen) => set({ settingsModalOpen }),
  setPresentationOpen: (presentationOpen) => {
    useMeetingStore.getState().setSplitViewOpen(presentationOpen);
    set({ presentationOpen });
  },

  setViewMode: (mode) => {
    if (mode === 'WALK') {
      get().enterWalkMode();
    } else {
      get().exitWalkMode();
    }
  },

  setDaylightPreset: (daylightPreset) => set({ daylightPreset }),
  setQualityPreset: (qualityPreset) =>
    set((state) => ({
      qualityPreset,
      effectiveQuality: qualityPreset === 'AUTO' ? state.effectiveQuality : qualityPreset,
    })),
  setEffectiveQuality: (effectiveQuality) => set({ effectiveQuality }),
  setDevPerfOpen: (devPerfOpen) => set({ devPerfOpen }),
  setRoomInspectionMode: (mode) => {
    const selRoom = get().selectedRoomId;
    if (selRoom) {
      get().focusRoom(selRoom, mode);
    } else {
      set({ roomInspectionMode: mode });
    }
  },

  setPlayerPosition: (playerPosition, roomId) =>
    set((state) => ({
      playerPosition,
      playerRoomId: roomId !== undefined ? roomId : state.playerRoomId,
    })),

  teleportPlayerToFloor: (floorIndex) => {
    const y = floorIndex * 4.2;
    set({
      playerPosition: [-4.2, y, 0.0],
      elevatorModalOpen: false,
    });
  },

  setNearbyInteraction: (nearbyInteraction) => set({ nearbyInteraction }),
  setExpandedScreenRoomId: (expandedScreenRoomId) => {
    if (expandedScreenRoomId && document.pointerLockElement) {
      document.exitPointerLock();
    }
    set({ expandedScreenRoomId });
  },
  setElevatorModalOpen: (elevatorModalOpen) => {
    if (elevatorModalOpen && document.pointerLockElement) {
      document.exitPointerLock();
    }
    set({ elevatorModalOpen });
  },
  setAmbientOverride: (agentId, override) =>
    set((state) => ({
      ambientOverrides: {
        ...state.ambientOverrides,
        [agentId]: override,
      },
    })),
  setAudioMuted: (audioMuted) => set({ audioMuted }),

  setActiveAppSection: (activeAppSection) => set({ activeAppSection }),
  setLeftNavCollapsed: (leftNavCollapsed) => set({ leftNavCollapsed }),
  setRightInspectorCollapsed: (rightInspectorCollapsed) => set({ rightInspectorCollapsed }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setAuthModalOpen: (authModalOpen) => set({ authModalOpen }),
  clearAuthSession: (openModal = true) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('forge_auth_token');
    }
    useEventStore.getState().setWsConnected(false);
    set({
      authToken: null,
      currentUser: null,
      activeWorkspace: null,
      workforceId: '',
      authModalOpen: openModal,
      projectSummary: null,
      finalReport: null,
      agents: INITIAL_FALLBACK_AGENTS,
      tasks: [],
      meetings: [],
      activeMeeting: null,
      activePresentation: null,
      tokenUsage: null,
      ceoOverview: null,
      artifacts: [],
      executions: [],
      queueItems: [],
      connectedRepositories: [],
      systemCapacity: null,
      githubStatus: 'NOT_CONNECTED',
      githubInstallation: null,
      githubError: null,
    });
  },
  setAuthSession: (token, user, workspace) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('forge_auth_token', token);
    }
    set({
      authToken: token,
      currentUser: user,
      activeWorkspace: workspace,
      workforceId: '',
      authModalOpen: false,
    });
    void get().fetchSnapshot();
  },
  hydrateAuthSession: async () => {
    const token = get().authToken;
    if (!token) return false;
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      const activeWsId = get().activeWorkspace?.id;
      if (activeWsId) headers['X-Workspace-Id'] = activeWsId;
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, { headers });
      if (res.status === 401) {
        get().clearAuthSession(true);
        return false;
      }
      if (!res.ok) return false;
      const data = await res.json();
      set({
        currentUser: data.user || null,
        activeWorkspace: data.active_workspace || null,
      });
      return true;
    } catch {
      return false;
    }
  },
  switchWorkspace: async (workspace) => {
    const token = get().authToken;
    if (!token) {
      get().clearAuthSession(true);
      return;
    }
    set({
      activeWorkspace: workspace,
      workforceId: '',
      tasks: [],
      executions: [],
      queueItems: [],
      artifacts: [],
      connectedRepositories: [],
      tokenUsage: null,
      ceoOverview: null,
      activeMeeting: null,
      activePresentation: null,
      githubStatus: 'NOT_CONNECTED',
      githubInstallation: null,
      githubError: null,
    });
    await get().hydrateAuthSession();
    await get().fetchSnapshot();
  },
  logoutSession: async () => {
    const token = get().authToken;
    if (token) {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    get().clearAuthSession(true);
  },

  createArtifact: async (artifactType, title, structuredContent = {}) => {
    const token = get().authToken;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/api/artifacts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        artifact_type: artifactType,
        title,
        workforce_id: get().workforceId,
        structured_content: structuredContent,
      }),
    });
    if (!res.ok) return null;
    const art = (await res.json()) as ArtifactItem;
    set((s) => ({ artifacts: [art, ...s.artifacts] }));
    return art;
  },

  fetchGitHubStatus: async () => {
    const token = get().authToken;
    const wsId = get().activeWorkspace?.id;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (wsId) headers['X-Workspace-Id'] = wsId;
    try {
      const res = await fetch(`${API_BASE_URL}/api/github/status`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      set({
        githubStatus: data.status === 'CONNECTED' ? 'CONNECTED' : 'NOT_CONNECTED',
        githubInstallation: data.installation || null,
        githubInstallUrl: data.install_url || null,
        githubOAuthConfigured: Boolean(data.oauth_configured),
        connectedRepositories: data.repositories || get().connectedRepositories,
        githubError: null,
      });
    } catch {
      // keep existing status on transient network failure
    }
  },

  connectGitHub: async (accountLogin) => {
    const token = get().authToken;
    const wsId = get().activeWorkspace?.id;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (wsId) headers['X-Workspace-Id'] = wsId;
    set({ githubStatus: 'CONNECTING', githubError: null });
    try {
      const payload: Record<string, string> = {};
      if (accountLogin && accountLogin.trim()) {
        payload.account_login = accountLogin.trim();
      }
      const res = await fetch(`${API_BASE_URL}/api/github/connect`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const rawDetail = err.detail;
        const msg = Array.isArray(rawDetail)
          ? rawDetail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join('; ')
          : typeof rawDetail === 'string'
          ? rawDetail
          : `GitHub App connection failed (${res.status})`;
        set({ githubStatus: 'ERROR', githubError: msg });
        useEventStore.getState().setErrorBanner(msg);
        return { ok: false, error: msg };
      }
      const data = await res.json();
      set({
        githubStatus: 'CONNECTED',
        githubInstallation: data.installation || null,
        connectedRepositories: data.repositories || [],
        githubError: null,
      });
      await get().fetchSnapshot();
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error connecting GitHub App';
      set({ githubStatus: 'ERROR', githubError: msg });
      useEventStore.getState().setErrorBanner(msg);
      return { ok: false, error: msg };
    }
  },

  startGitHubOAuth: async (mode = 'install') => {
    if (get().githubStatus === 'CONNECTING') return;
    const token = get().authToken;
    const wsId = get().activeWorkspace?.id;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (wsId) headers['X-Workspace-Id'] = wsId;
    set({ githubStatus: 'CONNECTING', githubError: null });
    try {
      const redirectUri = `${window.location.origin}/`;
      const res = await fetch(
        `${API_BASE_URL}/api/github/oauth/start?redirect_uri=${encodeURIComponent(redirectUri)}`,
        { headers }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = String(err.detail || `Unable to start GitHub authorization (${res.status})`);
        set({ githubStatus: 'ERROR', githubError: msg });
        useEventStore.getState().setErrorBanner(msg);
        return;
      }
      const data = await res.json();
      const targetUrl =
        mode === 'oauth'
          ? data.authorize_url
          : data.install_authorize_url || data.authorize_url;
      if (targetUrl) {
        window.location.href = targetUrl;
      } else {
        set({ githubStatus: 'ERROR', githubError: 'GitHub authorization URL was not returned by the server.' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error contacting server to start GitHub authorization.';
      set({ githubStatus: 'ERROR', githubError: msg });
      useEventStore.getState().setErrorBanner(msg);
    }
  },

  completeGitHubOAuth: async (code, state, installationId) => {
    const token = get().authToken;
    const wsId = get().activeWorkspace?.id;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (wsId) headers['X-Workspace-Id'] = wsId;
    set({ githubStatus: 'CONNECTING', githubError: null });
    try {
      const body: Record<string, string> = { code, state };
      if (installationId) body.installation_id = installationId;
      const res = await fetch(`${API_BASE_URL}/api/github/oauth/exchange`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const rawDetail = err.detail;
        const msg = Array.isArray(rawDetail)
          ? rawDetail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join('; ')
          : typeof rawDetail === 'string'
          ? rawDetail
          : `GitHub authorization callback failed (${res.status})`;
        set({ githubStatus: 'ERROR', githubError: msg });
        useEventStore.getState().setErrorBanner(msg);
        return { ok: false, error: msg };
      }
      const data = await res.json();
      set({
        githubStatus: 'CONNECTED',
        githubInstallation: data.installation || null,
        connectedRepositories: data.repositories || [],
        githubError: null,
      });
      await get().fetchSnapshot();
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error completing GitHub authorization.';
      set({ githubStatus: 'ERROR', githubError: msg });
      useEventStore.getState().setErrorBanner(msg);
      return { ok: false, error: msg };
    }
  },

  setGitHubError: (error) => {
    set({
      githubStatus: error ? 'ERROR' : 'NOT_CONNECTED',
      githubError: error,
    });
  },

  syncGitHubRepos: async () => {
    const token = get().authToken;
    const wsId = get().activeWorkspace?.id;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (wsId) headers['X-Workspace-Id'] = wsId;
    const res = await fetch(`${API_BASE_URL}/api/github/repositories/sync`, {
      method: 'POST',
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = String(err.detail || `Repository sync failed (${res.status})`);
      set({ githubError: msg });
      useEventStore.getState().setErrorBanner(msg);
      return;
    }
    const repos = await res.json();
    set({ connectedRepositories: repos, githubError: null });
  },

  syncRepoPulls: async (repoId) => {
    const token = get().authToken;
    const wsId = get().activeWorkspace?.id;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (wsId) headers['X-Workspace-Id'] = wsId;
    const res = await fetch(`${API_BASE_URL}/api/github/repositories/${encodeURIComponent(repoId)}/pulls/sync`, {
      method: 'POST',
      headers,
    });
    if (res.ok) {
      await get().fetchSnapshot();
    }
  },

  disconnectGitHub: async () => {
    const token = get().authToken;
    const wsId = get().activeWorkspace?.id;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (wsId) headers['X-Workspace-Id'] = wsId;
    const res = await fetch(`${API_BASE_URL}/api/github/disconnect`, { method: 'DELETE', headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = String(err.detail || `Unable to disconnect GitHub (${res.status})`);
      set({ githubError: msg });
      return;
    }
    set({ githubStatus: 'NOT_CONNECTED', githubInstallation: null, githubError: null, connectedRepositories: [] });
    await get().fetchSnapshot();
  },

  executeRepoBranch: async (repoId, branchName, filePath = 'README.md') => {
    const token = get().authToken;
    const wsId = get().activeWorkspace?.id;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (wsId) headers['X-Workspace-Id'] = wsId;
    const res = await fetch(`${API_BASE_URL}/api/github/repositories/${encodeURIComponent(repoId)}/execute-branch`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        execution_id: `exc_${Date.now().toString(36)}`,
        branch_name: branchName,
        file_path: filePath,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = String(err.detail || `GitHub branch execution failed (${res.status})`);
      set({ githubError: msg });
      useEventStore.getState().setErrorBanner(msg);
      return { ok: false, error: msg };
    }
    set({ githubError: null });
    await get().fetchSnapshot();
    return { ok: true };
  },

  decideApproval: async (executionId, approvalId, decision) => {
    const token = get().authToken;
    const wsId = get().activeWorkspace?.id;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (wsId) headers['X-Workspace-Id'] = wsId;
    const res = await fetch(
      `${API_BASE_URL}/api/executions/${encodeURIComponent(executionId)}/approvals/${encodeURIComponent(approvalId)}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ decision }),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = String(err.detail || `Approval / Pull Request action failed (${res.status})`);
      set({ githubError: msg });
      useEventStore.getState().setErrorBanner(msg);
      return { ok: false, error: msg };
    }
    const data = await res.json();
    set({ githubError: null });
    await get().fetchSnapshot();
    return { ok: true, pullRequest: data.pull_request || null };
  },

  cancelExecution: async (executionId) => {
    const token = get().authToken;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    await fetch(`${API_BASE_URL}/api/executions/${encodeURIComponent(executionId)}/cancel`, {
      method: 'POST',
      headers,
    });
    await get().fetchSnapshot();
  },

  updateAdminGovernor: async (config) => {
    const token = get().authToken;
    if (!token) {
      get().clearAuthSession(true);
      const msg = 'Authentication required (401). Please sign in.';
      useEventStore.getState().setErrorBanner(msg);
      return { ok: false, error: msg };
    }
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      const activeWsId = get().activeWorkspace?.id;
      if (activeWsId) headers['X-Workspace-Id'] = activeWsId;
      const res = await fetch(`${API_BASE_URL}/api/admin/governor`, {
        method: 'POST',
        headers,
        body: JSON.stringify(config),
      });
      if (res.status === 401) {
        get().clearAuthSession(true);
        const msg = 'Session expired or unauthorized (401). Please sign in again.';
        useEventStore.getState().setErrorBanner(msg);
        return { ok: false, error: msg };
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = typeof err.detail === 'string' ? err.detail : `Request failed (${res.status})`;
        const msg = res.status === 403 ? `Access denied (403): ${detail}` : `Governor update failed (${res.status}): ${detail}`;
        useEventStore.getState().setErrorBanner(msg);
        return { ok: false, error: msg };
      }
      useEventStore.getState().setErrorBanner(null);
      await get().fetchSnapshot();
      return { ok: true };
    } catch (err) {
      const msg = `Network error updating governor policy: ${String(err)}`;
      useEventStore.getState().setErrorBanner(msg);
      return { ok: false, error: msg };
    }
  },

  fetchSnapshot: async (workforceId) => {
    try {
      const token = get().authToken;
      if (!token) {
        return;
      }
      const target = workforceId || get().workforceId;
      const query = target && target !== 'current' ? `?workforce_id=${encodeURIComponent(target)}` : '';
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      const activeWsId = get().activeWorkspace?.id;
      if (activeWsId) headers['X-Workspace-Id'] = activeWsId;
      const res = await fetch(`${API_BASE_URL}/api/world/snapshot${query}`, { headers });
      if (res.status === 401) {
        get().clearAuthSession(true);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as WorldSnapshot;
      get().setSnapshot(data);
      useEventStore.getState().setErrorBanner(null);
    } catch (err) {
      useEventStore.getState().setErrorBanner(`Failed to fetch world snapshot: ${String(err)}`);
    }
  },

  deployWorkforce: async (name, objective, projectContext) => {
    set({ isDeploying: true });
    try {
      const token = get().authToken;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE_URL}/api/workforces`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name,
          objective,
          auto_deploy: true,
          project_context: projectContext || null,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg =
          typeof errData.detail === 'object' && errData.detail?.message
            ? errData.detail.message
            : errData.detail || `HTTP ${res.status}`;
        throw new Error(String(msg));
      }
      const snapshot = (await res.json()) as WorldSnapshot;
      get().setSnapshot(snapshot);
      set({ factoryModalOpen: false, isDeploying: false });
      useEventStore.getState().setErrorBanner(null);
    } catch (err) {
      set({ isDeploying: false });
      useEventStore.getState().setErrorBanner(`Workforce deployment error: ${String(err)}`);
    }
  },

  triggerBoardroomMeeting: async () => {
    try {
      const wfId = get().workforceId;
      const token = get().authToken;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      await fetch(`${API_BASE_URL}/api/meetings/trigger?workforce_id=${encodeURIComponent(wfId)}`, {
        method: 'POST',
        headers,
      });
      useMeetingStore.getState().setSplitViewOpen(true);
      get().selectRoom('boardroom', true);
    } catch (err) {
      useEventStore.getState().setErrorBanner(`Failed to trigger meeting: ${String(err)}`);
    }
  },

  sendAgentInstruction: async (agentId, instruction, assignAsTask = true) => {
    try {
      const token = get().authToken;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE_URL}/api/agents/${encodeURIComponent(agentId)}/instructions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          instruction,
          assign_as_task: assignAsTask,
          priority: 'HIGH',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = (await res.json()) as AgentProfile;
      set((state) => ({
        agents: state.agents.map((a) => (a.id === agentId ? updated : a)),
      }));
    } catch (err) {
      useEventStore.getState().setErrorBanner(`Failed to send instruction: ${String(err)}`);
    }
  },

  toggleAgentPause: async (agent) => {
    try {
      const action = agent.state === 'PAUSED' ? 'resume' : 'pause';
      const token = get().authToken;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE_URL}/api/agents/${encodeURIComponent(agent.id)}/${action}`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = (await res.json()) as AgentProfile;
      set((state) => ({
        agents: state.agents.map((a) => (a.id === agent.id ? updated : a)),
      }));
    } catch (err) {
      useEventStore.getState().setErrorBanner(`Failed to toggle agent pause: ${String(err)}`);
    }
  },

  setSimulationControl: async (speed, isPaused) => {
    const prevSpeed = get().simulationSpeed;
    const prevPaused = get().isPaused;
    set({
      simulationSpeed: speed ?? prevSpeed,
      isPaused: isPaused ?? prevPaused,
    });
    try {
      const wfId = get().workforceId;
      const token = get().authToken;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      await fetch(`${API_BASE_URL}/api/simulation/control?workforce_id=${encodeURIComponent(wfId)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ speed, is_paused: isPaused }),
      });
    } catch {
      // Keep local visual simulation state responsive
    }
  },
}));
