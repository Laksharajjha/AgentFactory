import React from 'react';
import { Factory, X } from 'lucide-react';
import { useWorldStore } from '../state/worldStore';
import { WorkforceBuilder } from './WorkforceBuilder';

interface FactoryPanelProps {
  isModal?: boolean;
}

export const FactoryPanel: React.FC<FactoryPanelProps> = ({ isModal = false }) => {
  const factoryModalOpen = useWorldStore((s) => s.factoryModalOpen);
  const setFactoryModalOpen = useWorldStore((s) => s.setFactoryModalOpen);

  if (isModal) {
    if (!factoryModalOpen) return null;
    return (
      <div
        onClick={() => setFactoryModalOpen(false)}
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl rounded-2xl bg-[#101622] border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/70">
            <div className="flex items-center gap-2">
              <Factory className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="text-sm font-bold text-white">
                  PROJECT FORGE — Agent Workforce Factory
                </h2>
                <p className="text-[11px] text-slate-400">
                  Submit an application objective or ZIP archive to dispatch Alex and the engineering team
                </p>
              </div>
            </div>
            <button
              onClick={() => setFactoryModalOpen(false)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5 overflow-y-auto">
            <WorkforceBuilder />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="text-xs font-bold text-white flex items-center gap-1.5">
        <Factory className="w-4 h-4 text-amber-400" /> Workforce Factory
      </div>
      <WorkforceBuilder />
    </div>
  );
};
