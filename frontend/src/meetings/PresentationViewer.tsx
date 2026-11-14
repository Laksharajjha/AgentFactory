import React from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  Code2,
  Cpu,
  Expand,
  FileSearch,
  GitBranch,
  Layers,
  ShieldAlert,
  X,
} from 'lucide-react';
import { MeetingPresentation } from '../types/meeting';

interface PresentationViewerProps {
  presentation: MeetingPresentation;
  isModal?: boolean;
  onExpand?: () => void;
  onClose?: () => void;
}

export const PresentationViewer: React.FC<PresentationViewerProps> = ({
  presentation,
  isModal = false,
  onExpand,
  onClose,
}) => {
  const data = presentation.structured_data || {};
  const pType = presentation.presentation_type;

  const renderStructuredBody = () => {
    if (pType === 'ARCHITECTURE_DIAGRAM') {
      const nodes = (data.nodes as Array<{ id: string; label: string; tier: string; status: string }>) || [];
      const edges = (data.edges as string[]) || [];
      return (
        <div className="space-y-3">
          {Boolean(data.current_flaw) && (
            <div className="p-2.5 rounded-lg bg-red-950/35 border border-red-800/50 text-xs text-red-200">
              <span className="font-semibold text-red-400">Bottleneck Identified: </span>
              {String(data.current_flaw)}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {nodes.map((node) => (
              <div
                key={node.id}
                className="p-2.5 rounded-lg bg-slate-900/90 border border-sky-500/30 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-sky-400 font-mono uppercase">{node.tier}</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                    {node.status}
                  </span>
                </div>
                <div className="text-xs font-bold text-white mt-1 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  {node.label}
                </div>
              </div>
            ))}
          </div>
          {edges.length > 0 && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 space-y-1">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Validated Service Contracts & Data Flow
              </div>
              {edges.map((edge, idx) => (
                <div key={idx} className="text-[11px] font-mono text-amber-300 flex items-center gap-1.5">
                  <GitBranch className="w-3 h-3 text-sky-400 shrink-0" />
                  <span>{edge}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (pType === 'CODE_SNIPPET') {
      const highlights = (data.highlights as string[]) || [];
      const code = String(data.code || '');
      return (
        <div className="space-y-2.5">
          {Boolean(data.file) && (
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
              <span>{String(data.file)}</span>
              <span className="text-sky-400 uppercase">{String(data.language || 'code')}</span>
            </div>
          )}
          <pre className="p-3 rounded-lg bg-[#070a0f] border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto leading-relaxed">
            {code}
          </pre>
          {highlights.length > 0 && (
            <ul className="space-y-1">
              {highlights.map((h, i) => (
                <li key={i} className="text-[11px] text-slate-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }

    if (pType === 'RISK_ASSESSMENT') {
      const matrix =
        (data.matrix as Array<{ domain: string; impact: string; effort: string; priority: string }>) || [];
      return (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between bg-amber-950/30 border border-amber-700/40 rounded-lg p-2.5 text-xs">
            <span className="text-amber-200 font-semibold flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-400" /> Overall Risk Exposure
            </span>
            <span className="font-mono font-bold text-amber-300">{String(data.overall_risk || 'HIGH')}</span>
          </div>
          <div className="space-y-1.5">
            {matrix.map((row, idx) => (
              <div
                key={idx}
                className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-white">{row.domain}</div>
                  <div className="text-[10px] text-slate-400">
                    Impact: <span className="text-amber-300">{row.impact}</span> • Effort: {row.effort}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-mono text-[11px] font-bold">
                  {row.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (pType === 'BUG_REPORT') {
      const gaps = (data.critical_gaps as Array<{ id: string; severity: string; issue: string }>) || [];
      return (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400">Current Coverage Baseline</div>
              <div className="text-sm font-bold text-amber-400">{String(data.baseline_coverage || '64%')}</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400">Required Merge Gate</div>
              <div className="text-sm font-bold text-emerald-400">{String(data.target_coverage || '92%')}</div>
            </div>
          </div>
          <div className="space-y-1.5">
            {gaps.map((g) => (
              <div key={g.id} className="p-2 rounded-lg bg-slate-950/90 border border-slate-800 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-amber-300 font-semibold">{g.id}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-mono">
                    {g.severity}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 mt-1">{g.issue}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (pType === 'DECISIONS' || pType === 'TASK_BREAKDOWN' || pType === 'PROGRESS_REPORT' || pType === 'RESEARCH_FINDINGS') {
      const phases =
        (data.phases as Array<{ phase: string; owner: string; deliverable: string }>) || [];
      return (
        <div className="space-y-2">
          {phases.length > 0 ? (
            phases.map((p, idx) => (
              <div key={idx} className="p-2.5 rounded-lg bg-slate-900/90 border border-emerald-500/30 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-300">{p.phase}</span>
                  <span className="text-[10px] font-mono text-amber-300">Owner: {p.owner}</span>
                </div>
                <div className="text-[11px] text-slate-200 mt-1">{p.deliverable}</div>
              </div>
            ))
          ) : (
            <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-200 overflow-x-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      );
    }

    return (
      <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-200 overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  const contentCard = (
    <div
      className={`rounded-xl border border-sky-500/40 bg-[#0c1424]/95 text-slate-100 shadow-2xl overflow-hidden ${
        isModal ? 'w-full max-w-3xl p-6' : 'p-3.5'
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-2.5 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono text-[10px] font-semibold flex items-center gap-1">
              {pType === 'CODE_SNIPPET' ? (
                <Code2 className="w-3 h-3" />
              ) : pType === 'BUG_REPORT' ? (
                <AlertOctagon className="w-3 h-3" />
              ) : pType === 'RESEARCH_FINDINGS' ? (
                <FileSearch className="w-3 h-3" />
              ) : (
                <Layers className="w-3 h-3" />
              )}
              {pType.replace(/_/g, ' ')}
            </span>
            <span className="text-[11px] text-slate-400">
              Presented by <strong className="text-amber-300">{presentation.presenter_name}</strong> ({presentation.presenter_role})
            </span>
          </div>
          <h4 className={`font-bold text-white mt-1 ${isModal ? 'text-lg' : 'text-sm'}`}>
            {presentation.title}
          </h4>
        </div>

        <div className="flex items-center gap-1.5">
          {!isModal && onExpand && (
            <button
              onClick={onExpand}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] flex items-center gap-1 transition"
              title="Expand Presentation"
            >
              <Expand className="w-3 h-3" /> Expand
            </button>
          )}
          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {renderStructuredBody()}
    </div>
  );

  if (isModal) {
    return (
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6"
      >
        <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl">
          {contentCard}
        </div>
      </div>
    );
  }

  return contentCard;
};
