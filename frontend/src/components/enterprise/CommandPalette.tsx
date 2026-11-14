import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  Cpu,
  FileArchive,
  FolderGit2,
  GitBranch,
  Layers,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { useWorldStore } from '../../state/worldStore';

interface CommandAction {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  shortcut?: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

export const CommandPalette: React.FC = () => {
  const open = useWorldStore((s) => s.commandPaletteOpen);
  const setOpen = useWorldStore((s) => s.setCommandPaletteOpen);
  const setActiveAppSection = useWorldStore((s) => s.setActiveAppSection);
  const setFactoryModalOpen = useWorldStore((s) => s.setFactoryModalOpen);
  const setSettingsModalOpen = useWorldStore((s) => s.setSettingsModalOpen);
  const setAuthModalOpen = useWorldStore((s) => s.setAuthModalOpen);
  const agents = useWorldStore((s) => s.agents);
  const selectAgent = useWorldStore((s) => s.selectAgent);
  const createArtifact = useWorldStore((s) => s.createArtifact);
  const connectGitHub = useWorldStore((s) => s.connectGitHub);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!open);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  const actions: CommandAction[] = useMemo(() => {
    const base: CommandAction[] = [
      {
        id: 'create-workforce',
        title: 'Create Workforce & Dispatch Objective',
        subtitle: 'Submit a new engineering task through the Resource Governor',
        category: 'Workforce',
        shortcut: 'N',
        icon: <Rocket className="w-4 h-4 text-[#D29A43]" />,
        onSelect: () => {
          setFactoryModalOpen(true);
          setOpen(false);
        },
      },
      {
        id: 'open-office',
        title: 'Go to 3D Autonomous Office',
        subtitle: 'Inspect the three-storey architectural headquarters',
        category: 'Navigation',
        shortcut: 'G O',
        icon: <Building2 className="w-4 h-4 text-[#4778D0]" />,
        onSelect: () => {
          setActiveAppSection('office');
          setOpen(false);
        },
      },
      {
        id: 'search-projects',
        title: 'Open Project Workspaces & Timeline',
        subtitle: 'Inspect connected repositories, tasks, meetings & decisions',
        category: 'Navigation',
        shortcut: 'G P',
        icon: <Layers className="w-4 h-4 text-[#4778D0]" />,
        onSelect: () => {
          setActiveAppSection('projects');
          setOpen(false);
        },
      },
      {
        id: 'connect-github',
        title: 'Connect GitHub App & Authorize Repositories',
        subtitle: 'Link Laksharajjha/AgentFactory for isolated branch execution',
        category: 'GitHub',
        shortcut: 'G H',
        icon: <FolderGit2 className="w-4 h-4 text-[#299B83]" />,
        onSelect: () => {
          void connectGitHub('Laksharajjha');
          setActiveAppSection('github');
          setOpen(false);
        },
      },
      {
        id: 'open-repo',
        title: 'Open Repository Browser & Pull Request Gate',
        subtitle: 'Inspect branches, diffs, sandbox test results and approve PRs',
        category: 'GitHub',
        icon: <GitBranch className="w-4 h-4 text-[#299B83]" />,
        onSelect: () => {
          setActiveAppSection('github');
          setOpen(false);
        },
      },
      {
        id: 'search-artifacts',
        title: 'Open Universal Artifact Library (PPTX, DOCX, XLSX, PDF)',
        subtitle: 'Preview, validate and download persistent deliverables',
        category: 'Artifacts',
        shortcut: 'G A',
        icon: <FileArchive className="w-4 h-4 text-[#D29A43]" />,
        onSelect: () => {
          setActiveAppSection('artifacts');
          setOpen(false);
        },
      },
      {
        id: 'gen-pptx',
        title: 'Generate Executive Presentation Deck (.pptx)',
        subtitle: 'Deterministically generate and store a validated PPTX deliverable',
        category: 'Artifacts',
        icon: <FileArchive className="w-4 h-4 text-[#299B83]" />,
        onSelect: () => {
          void createArtifact('PPTX', 'Executive Architecture & Security Deck');
          setActiveAppSection('artifacts');
          setOpen(false);
        },
      },
      {
        id: 'open-executions',
        title: 'Open Execution History & Durable Fair Queue',
        subtitle: 'Monitor active leases, queue positions, tool calls & verification',
        category: 'Infrastructure',
        shortcut: 'G E',
        icon: <Activity className="w-4 h-4 text-[#4778D0]" />,
        onSelect: () => {
          setActiveAppSection('executions');
          setOpen(false);
        },
      },
      {
        id: 'inspect-status',
        title: 'Inspect Administrator Capacity & Resource Governor',
        subtitle: 'Configure concurrency limits, queue quotas, memory/CPU & Gemini RPM',
        category: 'Administration',
        shortcut: 'G C',
        icon: <Cpu className="w-4 h-4 text-[#C45D62]" />,
        onSelect: () => {
          setActiveAppSection('admin');
          setOpen(false);
        },
      },
      {
        id: 'open-auth',
        title: 'Switch User Account / Multi-Tenant Workspace',
        subtitle: 'Register, sign in, or switch isolated tenant workspaces',
        category: 'Identity',
        icon: <ShieldCheck className="w-4 h-4 text-[#299B83]" />,
        onSelect: () => {
          setAuthModalOpen(true);
          setOpen(false);
        },
      },
      {
        id: 'open-settings',
        title: 'Open AI Gateway & 3D Rendering Settings',
        subtitle: 'Configure Gemini API key, Free-Tier model & graphics preset',
        category: 'Settings',
        shortcut: ',',
        icon: <Settings className="w-4 h-4 text-[#A5ACB8]" />,
        onSelect: () => {
          setSettingsModalOpen(true);
          setOpen(false);
        },
      },
    ];

    const agentCommands: CommandAction[] = agents.map((ag) => ({
      id: `agent-${ag.id}`,
      title: `Inspect Agent: ${ag.name} (${ag.role})`,
      subtitle: `${ag.state} • ${ag.current_room_id.replace('_', ' ')}`,
      category: 'AI Employees',
      icon: <User className="w-4 h-4 text-[#4778D0]" />,
      onSelect: () => {
        setActiveAppSection('office');
        selectAgent(ag.id, true);
        setOpen(false);
      },
    }));

    return [...base, ...agentCommands];
  }, [
    agents,
    connectGitHub,
    createArtifact,
    selectAgent,
    setActiveAppSection,
    setAuthModalOpen,
    setFactoryModalOpen,
    setOpen,
    setSettingsModalOpen,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.subtitle.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    );
  }, [actions, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, open]);

  if (!open) return null;

  return (
    <div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#151920] border border-[#343A45] rounded-md shadow-2xl overflow-hidden text-[#E8EBF0]"
      >
        {/* Search Input Header */}
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-[#343A45] bg-[#101216]">
          <Search className="w-4 h-4 text-[#737D8C]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((i) => Math.min(filtered.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter' && filtered[selectedIndex]) {
                e.preventDefault();
                filtered[selectedIndex].onSelect();
              }
            }}
            placeholder="Type a command or search projects, agents, artifacts, repositories..."
            className="flex-1 bg-transparent text-xs text-[#E8EBF0] placeholder-[#737D8C] focus:outline-none"
          />
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#22262E] text-[#A5ACB8] border border-[#343A45]">
            ESC
          </span>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-[#22262E] text-[#737D8C] hover:text-[#E8EBF0]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto p-1.5 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#737D8C]">
              No matching commands found for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={item.onSelect}
                  className={`w-full px-3 py-2 rounded-md flex items-center justify-between text-left transition ${
                    isSelected
                      ? 'bg-[#22262E] text-[#E8EBF0] border border-[#4778D0]/50'
                      : 'text-[#A5ACB8] hover:bg-[#1B2028] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded bg-[#101216] border border-[#343A45] shrink-0">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#E8EBF0] truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-[#737D8C] truncate">{item.subtitle}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[10px] font-mono text-[#737D8C]">{item.category}</span>
                    {item.shortcut && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#101216] border border-[#343A45] text-[#A5ACB8]">
                        {item.shortcut}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-3.5 py-2 border-t border-[#343A45] bg-[#101216] flex items-center justify-between text-[10px] text-[#737D8C] font-mono">
          <span>↑↓ Navigate • ↵ Execute</span>
          <span>PROJECT FORGE 3.0 COMMAND PALETTE</span>
        </div>
      </div>
    </div>
  );
};
