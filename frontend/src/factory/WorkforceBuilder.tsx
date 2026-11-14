import React, { useState } from 'react';
import {
  CheckCircle2,
  FileArchive,
  Loader2,
  Rocket,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useWorldStore } from '../state/worldStore';
import { ProjectSummary } from '../types/world';
import { AgentBlueprint } from './AgentBlueprint';

const DEFINITIVE_DEMO_PROMPT =
  'Analyse this software application. Identify architectural weaknesses, security concerns and opportunities for improvement. Create a refactoring strategy.';

interface PreviewPlan {
  objective_summary: string;
  required_capabilities: string[];
  agents: Array<{
    agent_key: string;
    name: string;
    role: string;
    department: string;
    home_room_id: string;
    capabilities: string[];
    tools: string[];
    token_budget: number;
    avatar_config?: { accent_color?: string; badge?: string };
  }>;
  tasks: Array<{
    key: string;
    title: string;
    description: string;
    assigned_agent_key: string;
    target_room_id: string;
    priority: string;
    deliverables: string[];
  }>;
  validation_passed: boolean;
}

export const WorkforceBuilder: React.FC = () => {
  const [projectName, setProjectName] = useState('Enterprise Core Architecture Audit');
  const [objective, setObjective] = useState(DEFINITIVE_DEMO_PROMPT);
  const [zipSummary, setZipSummary] = useState<ProjectSummary | null>(null);
  const [isAnalyzingZip, setIsAnalyzingZip] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [previewPlan, setPreviewPlan] = useState<PreviewPlan | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const deployWorkforce = useWorldStore((s) => s.deployWorkforce);
  const isDeploying = useWorldStore((s) => s.isDeploying);

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzingZip(true);
    setZipError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE_URL}/api/projects/analyze-zip`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Upload failed (${res.status})`);
      }
      const data = await res.json();
      setZipSummary(data.project_summary as ProjectSummary);
    } catch (err) {
      setZipError(String(err));
    } finally {
      setIsAnalyzingZip(false);
    }
  };

  const handleValidatePlan = async () => {
    if (!objective.trim()) return;
    setIsPreviewing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/workforces/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          objective,
          auto_deploy: false,
          project_context: zipSummary,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPreviewPlan(data.plan as PreviewPlan);
    } catch {
      // ignore preview error
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleDeploy = async () => {
    if (!objective.trim()) return;
    await deployWorkforce(projectName, objective, zipSummary);
  };

  return (
    <div className="space-y-4 text-slate-200">
      {/* Quick Demo Preset Banner */}
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2">
        <div className="text-xs">
          <div className="font-bold text-amber-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Definitive End-to-End Mission Preset
          </div>
          <div className="text-[11px] text-slate-300 mt-0.5">
            Dispatches all 6 employees via Alex&apos;s CEO Office, runs lab analyses, and convenes a live Boardroom session.
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setProjectName('Enterprise Core Architecture Audit');
            setObjective(DEFINITIVE_DEMO_PROMPT);
          }}
          className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[11px] font-semibold shrink-0"
        >
          Load Preset
        </button>
      </div>

      {/* Initiative Name & Objective */}
      <div className="space-y-2.5">
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
            Initiative / Project Name
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
            Project Objective / Requirements Specification
          </label>
          <textarea
            rows={4}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Describe the software application, architectural audit, or engineering task..."
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg p-3 text-xs text-white leading-relaxed focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Optional Safe ZIP Archive Upload (Part 16) */}
      <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <FileArchive className="w-3.5 h-3.5 text-sky-400" />
            Optional Project Archive (.ZIP Static Inspection)
          </div>
          <label className="cursor-pointer px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-sky-300 font-medium flex items-center gap-1 transition">
            <Upload className="w-3 h-3" />
            {isAnalyzingZip ? 'Inspecting...' : 'Upload .ZIP'}
            <input
              type="file"
              accept=".zip"
              onChange={handleZipUpload}
              className="hidden"
            />
          </label>
        </div>
        <p className="text-[10px] text-slate-400">
          Safely inspects source files in memory, ignoring binaries and secrets. Uploaded code is never executed.
        </p>

        {zipError && (
          <div className="text-[11px] text-red-300 bg-red-950/40 border border-red-800/50 rounded p-2">
            {zipError}
          </div>
        )}

        {zipSummary && (
          <div className="p-2.5 rounded-lg bg-slate-950 border border-emerald-500/30 space-y-1 text-[11px]">
            <div className="flex items-center justify-between text-emerald-300 font-semibold">
              <span>Archive Analyzed: {zipSummary.archive_name}</span>
              <span>{zipSummary.file_count} files ({zipSummary.total_lines_of_code} LOC)</span>
            </div>
            <div className="text-slate-300">
              Languages: <span className="text-amber-300">{zipSummary.languages?.join(', ')}</span> • Frameworks:{' '}
              <span className="text-sky-300">{zipSummary.frameworks?.join(', ')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons: Validate Plan & Deploy Workforce */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => void handleValidatePlan()}
          disabled={isPreviewing || isDeploying}
          className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 border border-slate-700 transition"
        >
          {isPreviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 text-sky-400" />}
          Validate Workforce Blueprint
        </button>

        <button
          type="button"
          onClick={() => void handleDeploy()}
          disabled={isDeploying}
          className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition"
        >
          {isDeploying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Deploying Workforce to CEO Office...
            </>
          ) : (
            <>
              <Rocket className="w-4 h-4" /> Approve & Deploy Autonomous Workforce
            </>
          )}
        </button>
      </div>

      {/* Previewed Blueprint Validation Result */}
      {previewPlan && (
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Blueprint Validated ({previewPlan.agents.length} Agents,{' '}
              {previewPlan.tasks.length} Tasks)
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
            {previewPlan.agents.map((ag) => (
              <AgentBlueprint key={ag.agent_key} blueprint={ag} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
