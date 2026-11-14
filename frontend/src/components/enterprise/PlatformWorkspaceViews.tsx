import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  FileArchive,
  FolderGit2,
  GitBranch,
  GitPullRequest,
  Layers,
  Lock,
  Play,
  Plus,
  ShieldCheck,
  Terminal,
  XCircle,
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { useWorldStore } from '../../state/worldStore';

export const PlatformWorkspaceViews: React.FC = () => {
  const activeAppSection = useWorldStore((s) => s.activeAppSection);
  const setActiveAppSection = useWorldStore((s) => s.setActiveAppSection);
  const workforceName = useWorldStore((s) => s.workforceName);
  const objective = useWorldStore((s) => s.objective);
  const workforceStatus = useWorldStore((s) => s.workforceStatus);
  const agents = useWorldStore((s) => s.agents);
  const tasks = useWorldStore((s) => s.tasks);
  const meetings = useWorldStore((s) => s.meetings);
  const artifacts = useWorldStore((s) => s.artifacts);
  const executions = useWorldStore((s) => s.executions);
  const queueItems = useWorldStore((s) => s.queueItems);
  const connectedRepositories = useWorldStore((s) => s.connectedRepositories);
  const systemCapacity = useWorldStore((s) => s.systemCapacity);
  const currentUser = useWorldStore((s) => s.currentUser);
  const activeWorkspace = useWorldStore((s) => s.activeWorkspace);

  const createArtifact = useWorldStore((s) => s.createArtifact);
  const connectGitHub = useWorldStore((s) => s.connectGitHub);
  const executeRepoBranch = useWorldStore((s) => s.executeRepoBranch);
  const decideApproval = useWorldStore((s) => s.decideApproval);
  const cancelExecution = useWorldStore((s) => s.cancelExecution);
  const updateAdminGovernor = useWorldStore((s) => s.updateAdminGovernor);
  const setFactoryModalOpen = useWorldStore((s) => s.setFactoryModalOpen);
  const setAuthModalOpen = useWorldStore((s) => s.setAuthModalOpen);
  const setSettingsModalOpen = useWorldStore((s) => s.setSettingsModalOpen);

  const [newArtType, setNewArtType] = useState('PPTX');
  const [newArtTitle, setNewArtTitle] = useState('Autonomous Architecture & Security Briefing');
  const [creatingArt, setCreatingArt] = useState(false);

  const [ghAccountInput, setGhAccountInput] = useState('Laksharajjha');
  const [branchInput, setBranchInput] = useState('forge/zero-trust-middleware');
  const [runningBranch, setRunningBranch] = useState(false);

  const [govMaxConcurrent, setGovMaxConcurrent] = useState(
    systemCapacity?.max_concurrent_workforces ?? 2
  );
  const [govPerUserExec, setGovPerUserExec] = useState(
    systemCapacity?.max_concurrent_executions_per_user ?? 1
  );
  const [govGlobalQueue, setGovGlobalQueue] = useState(
    systemCapacity?.max_global_queued_workforces ?? 10
  );
  const [govPaused, setGovPaused] = useState(systemCapacity?.admission_paused ?? false);

  const handleGenerateArtifact = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingArt(true);
    try {
      await createArtifact(newArtType, newArtTitle);
    } finally {
      setCreatingArt(false);
    }
  };

  const handleRunBranchWorkflow = async (repoId: string) => {
    setRunningBranch(true);
    try {
      await executeRepoBranch(repoId, branchInput);
    } finally {
      setRunningBranch(false);
    }
  };

  if (activeAppSection === 'artifacts') {
    return (
      <div className="flex-1 h-full overflow-y-auto bg-[#101216] p-6 text-[#E8EBF0] space-y-6">
        <div className="flex items-center justify-between border-b border-[#343A45] pb-4">
          <div>
            <h1 className="text-base font-semibold text-[#E8EBF0] flex items-center gap-2">
              <FileArchive className="w-4 h-4 text-[#D29A43]" />
              Universal Artifact Generation Engine & Workspace Library
            </h1>
            <p className="text-xs text-[#A5ACB8] mt-0.5">
              Deterministic OOXML (.pptx, .docx, .xlsx), PDF 1.4, SVG, PNG, CSV & ZIP deliverables stored with SHA-256 verification and short-lived signed download URLs.
            </p>
          </div>
          <button
            onClick={() => setActiveAppSection('office')}
            className="px-3 py-1.5 rounded-md bg-[#1B2028] hover:bg-[#22262E] border border-[#343A45] text-xs text-[#E8EBF0]"
          >
            Return to 3D Office
          </button>
        </div>

        {/* Deterministic Artifact Generator Form */}
        <form
          onSubmit={handleGenerateArtifact}
          className="p-4 rounded-md bg-[#151920] border border-[#343A45] flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="block text-[11px] font-mono uppercase text-[#737D8C] mb-1">
              Format
            </label>
            <select
              value={newArtType}
              onChange={(e) => setNewArtType(e.target.value)}
              className="px-3 py-1.5 rounded-md bg-[#101216] border border-[#343A45] text-xs text-[#E8EBF0]"
            >
              <option value="PPTX">PPTX — Presentation Deck</option>
              <option value="DOCX">DOCX — Technical Specification</option>
              <option value="XLSX">XLSX — Engineering Workbook</option>
              <option value="PDF">PDF — Executive Dossier</option>
              <option value="SVG">SVG — Architecture Diagram</option>
              <option value="PNG">PNG — Raster Preview</option>
              <option value="CSV">CSV — Telemetry Export</option>
              <option value="MARKDOWN">MD — Markdown Report</option>
              <option value="ZIP">ZIP — Source Bundle</option>
            </select>
          </div>

          <div className="flex-1 min-w-[240px]">
            <label className="block text-[11px] font-mono uppercase text-[#737D8C] mb-1">
              Deliverable Title
            </label>
            <input
              value={newArtTitle}
              onChange={(e) => setNewArtTitle(e.target.value)}
              className="w-full px-3 py-1.5 rounded-md bg-[#101216] border border-[#343A45] text-xs text-[#E8EBF0]"
            />
          </div>

          <button
            type="submit"
            disabled={creatingArt}
            className="px-4 py-1.5 rounded-md bg-[#4778D0] hover:bg-[#3b67b8] text-xs font-medium text-[#E8EBF0] flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{creatingArt ? 'Generating...' : 'Generate & Validate Artifact'}</span>
          </button>
        </form>

        {/* Artifact Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {artifacts.length === 0 ? (
            <div className="col-span-full p-8 rounded-md bg-[#151920] border border-[#343A45] text-center text-xs text-[#737D8C]">
              No artifacts generated in this workspace yet. Click &ldquo;Generate &amp; Validate Artifact&rdquo; above or launch a workforce run.
            </div>
          ) : (
            artifacts.map((art) => (
              <div
                key={art.id}
                className="p-4 rounded-md bg-[#151920] border border-[#343A45] flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-[#22262E] border border-[#343A45] font-mono text-[10px] font-semibold text-[#D29A43]">
                      {art.artifact_type} • v{art.version}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#299B83]/15 text-[#299B83] font-mono text-[10px]">
                      {art.validation_status}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-[#E8EBF0] truncate">
                    {art.filename}
                  </div>
                  <div className="text-[11px] text-[#A5ACB8] font-mono">
                    {(art.file_size / 1024).toFixed(2)} KB • SHA256: {art.checksum_sha256.slice(0, 12)}...
                  </div>
                </div>

                <div className="pt-2 border-t border-[#343A45] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#737D8C]">{art.id}</span>
                  <a
                    href={`${API_BASE_URL}${art.download_url}`}
                    download={art.filename}
                    className="px-2.5 py-1 rounded bg-[#22262E] hover:bg-[#4778D0] border border-[#343A45] text-[11px] font-medium text-[#E8EBF0] flex items-center gap-1 transition"
                  >
                    <Download className="w-3 h-3" />
                    <span>Signed Download</span>
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (activeAppSection === 'github') {
    return (
      <div className="flex-1 h-full overflow-y-auto bg-[#101216] p-6 text-[#E8EBF0] space-y-6">
        <div className="flex items-center justify-between border-b border-[#343A45] pb-4">
          <div>
            <h1 className="text-base font-semibold text-[#E8EBF0] flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-[#299B83]" />
              GitHub App Integration & Isolated Repository Sandboxes
            </h1>
            <p className="text-xs text-[#A5ACB8] mt-0.5">
              Fernet-encrypted short-lived installation tokens. Default branches are protected; all autonomous edits run on isolated working branches with mandatory PR approval gates.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={ghAccountInput}
              onChange={(e) => setGhAccountInput(e.target.value)}
              placeholder="GitHub Owner / Org"
              className="px-2.5 py-1.5 rounded-md bg-[#151920] border border-[#343A45] text-xs text-[#E8EBF0]"
            />
            <button
              onClick={() => void connectGitHub(ghAccountInput)}
              className="px-3 py-1.5 rounded-md bg-[#299B83] hover:bg-[#23846f] text-xs font-medium text-[#E8EBF0]"
            >
              Connect GitHub App
            </button>
          </div>
        </div>

        {connectedRepositories.length === 0 ? (
          <div className="p-8 rounded-md bg-[#151920] border border-[#343A45] text-center space-y-3">
            <div className="text-xs text-[#A5ACB8]">
              No GitHub repositories connected to this workspace yet.
            </div>
            <button
              onClick={() => void connectGitHub(ghAccountInput)}
              className="px-4 py-2 rounded-md bg-[#4778D0] text-xs font-semibold text-[#E8EBF0]"
            >
              Authorize & Connect Laksharajjha/AgentFactory
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {connectedRepositories.map((repo) => (
              <div
                key={repo.id}
                className="p-4 rounded-md bg-[#151920] border border-[#343A45] space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#E8EBF0]">
                        {repo.full_name}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#22262E] border border-[#343A45] font-mono text-[10px] text-[#A5ACB8]">
                        default: {repo.default_branch} (PROTECTED)
                      </span>
                    </div>
                    <div className="text-[11px] text-[#737D8C] font-mono mt-0.5">
                      {repo.clone_url}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      value={branchInput}
                      onChange={(e) => setBranchInput(e.target.value)}
                      placeholder="Working branch (e.g. forge/patch)"
                      className="px-2.5 py-1 rounded bg-[#101216] border border-[#343A45] text-xs font-mono text-[#E8EBF0]"
                    />
                    <button
                      disabled={runningBranch}
                      onClick={() => void handleRunBranchWorkflow(repo.id)}
                      className="px-3 py-1.5 rounded-md bg-[#4778D0] hover:bg-[#3b67b8] text-xs font-medium text-[#E8EBF0] flex items-center gap-1.5"
                    >
                      <Play className="w-3 h-3" />
                      <span>
                        {runningBranch
                          ? 'Running Sandbox Tests...'
                          : 'Execute Isolated Branch & Run Tests'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Open Pull Requests */}
                {(repo.repo_metadata?.open_prs || []).length > 0 && (
                  <div className="pt-3 border-t border-[#343A45] space-y-2">
                    <div className="text-[11px] font-mono uppercase text-[#A5ACB8] flex items-center gap-1.5">
                      <GitPullRequest className="w-3.5 h-3.5 text-[#299B83]" />
                      Created Pull Requests (Auto-Merge Disabled)
                    </div>
                    <div className="space-y-1.5">
                      {(repo.repo_metadata.open_prs || []).map((pr) => (
                        <div
                          key={pr.number}
                          className="p-2.5 rounded bg-[#101216] border border-[#343A45] flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-mono text-[#299B83] mr-2">#{pr.number}</span>
                            <span className="font-medium text-[#E8EBF0]">{pr.title}</span>
                            <span className="ml-2 font-mono text-[10px] text-[#737D8C]">
                              ({pr.head} → {pr.base})
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-[#299B83]/20 text-[#299B83] font-mono text-[10px]">
                            {pr.status} • {pr.diff_lines} diff lines
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pending Approval Gates */}
        <div className="space-y-3">
          <h2 className="text-xs font-mono uppercase text-[#A5ACB8] flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-[#D29A43]" />
            Pending Pull Request Approval Gates & Unified Git Diffs
          </h2>
          {executions.flatMap((ex) =>
            (ex.approvals || []).map((ap) => ({ ex, ap }))
          ).length === 0 ? (
            <div className="p-4 rounded-md bg-[#151920] border border-[#343A45] text-xs text-[#737D8C]">
              No pending approval gates. Run an isolated branch execution or deploy a workforce to generate a verified diff.
            </div>
          ) : (
            executions.map((ex) =>
              (ex.approvals || []).map((ap) => (
                <div
                  key={ap.id}
                  className="p-4 rounded-md bg-[#151920] border border-[#343A45] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-[#E8EBF0]">{ap.title}</div>
                      <div className="text-[11px] text-[#A5ACB8] mt-0.5">{ap.description}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                        ap.status === 'APPROVED'
                          ? 'bg-[#299B83]/20 text-[#299B83]'
                          : ap.status === 'REJECTED'
                          ? 'bg-[#C45D62]/20 text-[#C45D62]'
                          : 'bg-[#D29A43]/20 text-[#D29A43]'
                      }`}
                    >
                      {ap.status}
                    </span>
                  </div>

                  {ap.diff_preview && (
                    <pre className="p-3 rounded bg-[#101216] border border-[#343A45] font-mono text-[11px] text-[#A5ACB8] overflow-x-auto max-h-48">
                      {ap.diff_preview}
                    </pre>
                  )}

                  {ap.status === 'PENDING' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void decideApproval(ex.id, ap.id, 'APPROVED')}
                        className="px-3 py-1.5 rounded bg-[#299B83] hover:bg-[#23846f] text-xs font-medium text-[#E8EBF0] flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve & Create Pull Request</span>
                      </button>
                      <button
                        onClick={() => void decideApproval(ex.id, ap.id, 'REJECTED')}
                        className="px-3 py-1.5 rounded bg-[#1B2028] hover:bg-[#C45D62]/20 border border-[#343A45] text-xs text-[#C45D62] flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )
          )}
        </div>
      </div>
    );
  }

  if (activeAppSection === 'executions') {
    return (
      <div className="flex-1 h-full overflow-y-auto bg-[#101216] p-6 text-[#E8EBF0] space-y-6">
        <div className="flex items-center justify-between border-b border-[#343A45] pb-4">
          <div>
            <h1 className="text-base font-semibold text-[#E8EBF0] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#4778D0]" />
              Durable Execution Queue & Verifiable Tool Audit Ledger
            </h1>
            <p className="text-xs text-[#A5ACB8] mt-0.5">
              Round-robin fair scheduling across users. Closing the browser or logging out never cancels accepted executions.
            </p>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="px-2.5 py-1 rounded bg-[#151920] border border-[#343A45] text-[#299B83]">
              Available Slots: {systemCapacity?.available_execution_slots ?? 2} /{' '}
              {systemCapacity?.max_concurrent_workforces ?? 2}
            </span>
            <span className="px-2.5 py-1 rounded bg-[#151920] border border-[#343A45] text-[#D29A43]">
              Queued: {systemCapacity?.queued_executions ?? 0}
            </span>
          </div>
        </div>

        {/* Queue Table */}
        <div className="space-y-2">
          <h2 className="text-xs font-mono uppercase text-[#A5ACB8]">
            Workspace Queue & Lease Status
          </h2>
          <div className="rounded-md bg-[#151920] border border-[#343A45] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#101216] border-b border-[#343A45] text-[10px] font-mono uppercase text-[#737D8C]">
                <tr>
                  <th className="py-2.5 px-3">Execution ID</th>
                  <th className="py-2.5 px-3">Workforce</th>
                  <th className="py-2.5 px-3">Lifecycle State</th>
                  <th className="py-2.5 px-3">Queue Position</th>
                  <th className="py-2.5 px-3">Submitted At</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#343A45]">
                {queueItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-[#737D8C]">
                      No executions in queue.
                    </td>
                  </tr>
                ) : (
                  queueItems.map((q) => (
                    <tr key={q.id} className="hover:bg-[#1B2028]">
                      <td className="py-2.5 px-3 font-mono text-[#E8EBF0]">{q.execution_id}</td>
                      <td className="py-2.5 px-3 font-mono text-[#A5ACB8]">{q.workforce_id}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-[#22262E] font-mono text-[10px] text-[#D29A43]">
                          {q.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {q.queue_position ? `#${q.queue_position}` : 'ACTIVE / DONE'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#737D8C]">
                        {q.queued_at.slice(0, 19).replace('T', ' ')}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {['QUEUED', 'ADMITTED', 'RUNNING'].includes(q.status) && (
                          <button
                            onClick={() => void cancelExecution(q.execution_id)}
                            className="px-2 py-1 rounded bg-[#C45D62]/20 hover:bg-[#C45D62]/30 text-[#C45D62] font-mono text-[10px]"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Execution Details & Tool Call Audit Records */}
        <div className="space-y-3">
          <h2 className="text-xs font-mono uppercase text-[#A5ACB8]">
            Execution Lifecycle & Permission-Checked Tool Calls
          </h2>
          {executions.map((ex) => (
            <div
              key={ex.id}
              className="p-4 rounded-md bg-[#151920] border border-[#343A45] space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-semibold text-[#E8EBF0]">{ex.id}</span>
                  <span className="px-2 py-0.5 rounded bg-[#22262E] border border-[#343A45] font-mono text-[10px] text-[#299B83]">
                    {ex.status}
                  </span>
                  <span className="font-mono text-[11px] text-[#737D8C]">
                    Branch: {ex.working_branch || 'forge/main'}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-[#A5ACB8]">
                  {(ex.tool_calls || []).length} auditable tool calls • {ex.tokens_used} tokens
                </div>
              </div>

              {(ex.tool_calls || []).length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2 border-t border-[#343A45]">
                  {ex.tool_calls.map((tc) => (
                    <div
                      key={tc.id}
                      className="p-2 rounded bg-[#101216] border border-[#343A45] flex items-center justify-between text-[11px] font-mono"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Terminal className="w-3 h-3 text-[#4778D0] shrink-0" />
                        <span className="text-[#E8EBF0] truncate">{tc.tool_name}</span>
                      </div>
                      <span className="text-[#299B83] shrink-0">{tc.duration_ms}ms</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeAppSection === 'admin') {
    return (
      <div className="flex-1 h-full overflow-y-auto bg-[#101216] p-6 text-[#E8EBF0] space-y-6">
        <div className="flex items-center justify-between border-b border-[#343A45] pb-4">
          <div>
            <h1 className="text-base font-semibold text-[#E8EBF0] flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#C45D62]" />
              Administrator Capacity & Resource Governor Dashboard
            </h1>
            <p className="text-xs text-[#A5ACB8] mt-0.5">
              Restricted to Platform Administrators. Controls admission backpressure, concurrency slots, and per-user quotas.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded bg-[#299B83]/20 border border-[#299B83]/40 font-mono text-[11px] text-[#299B83]">
            ROLE: {currentUser?.platform_role || 'PLATFORM_ADMIN'}
          </span>
        </div>

        {/* Real-Time Telemetry Cards (Part 18 Specification) */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {[
            { label: 'Authenticated Users', val: systemCapacity?.authenticated_users ?? 1 },
            { label: 'Active Sessions', val: systemCapacity?.active_sessions ?? 1 },
            {
              label: 'Active Executions',
              val: `${systemCapacity?.active_executions ?? 0} / ${
                systemCapacity?.max_concurrent_workforces ?? 2
              }`,
            },
            {
              label: 'Queued Executions',
              val: `${systemCapacity?.queued_executions ?? 0} (${
                systemCapacity?.queue_utilization_pct ?? 0
              }%)`,
            },
            { label: 'Available Slots', val: systemCapacity?.available_execution_slots ?? 2 },
            { label: 'Active Sandboxes', val: systemCapacity?.active_sandboxes ?? 0 },
            { label: 'API Memory', val: `${systemCapacity?.api_memory_mb ?? 64} MB` },
            { label: 'API CPU Time', val: `${systemCapacity?.api_cpu_seconds ?? 1.2}s` },
            { label: 'DB Pool Size', val: systemCapacity?.db_pool_size ?? 5 },
            {
              label: 'Artifact Storage',
              val: `${((systemCapacity?.storage_bytes_used ?? 0) / 1024).toFixed(1)} KB`,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-3.5 rounded-md bg-[#151920] border border-[#343A45] space-y-1"
            >
              <div className="text-[10px] font-mono uppercase text-[#737D8C]">{stat.label}</div>
              <div className="text-sm font-mono font-semibold text-[#E8EBF0]">{stat.val}</div>
            </div>
          ))}
        </div>

        {/* Administrator Governor Configuration Form */}
        <div className="p-5 rounded-md bg-[#151920] border border-[#343A45] space-y-4 max-w-2xl">
          <div className="text-xs font-semibold text-[#E8EBF0] uppercase font-mono">
            Resource Governor Admission Controls
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-[11px] text-[#A5ACB8] mb-1">
                Max Concurrent Workforces
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={govMaxConcurrent}
                onChange={(e) => setGovMaxConcurrent(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded bg-[#101216] border border-[#343A45] font-mono text-[#E8EBF0]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#A5ACB8] mb-1">
                Per-User Concurrent Limit
              </label>
              <input
                type="number"
                min={1}
                max={5}
                value={govPerUserExec}
                onChange={(e) => setGovPerUserExec(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded bg-[#101216] border border-[#343A45] font-mono text-[#E8EBF0]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#A5ACB8] mb-1">
                Global Queue Capacity
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={govGlobalQueue}
                onChange={(e) => setGovGlobalQueue(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded bg-[#101216] border border-[#343A45] font-mono text-[#E8EBF0]"
              />
            </div>
          </div>

          <label className="flex items-center justify-between p-3 rounded bg-[#101216] border border-[#343A45] cursor-pointer text-xs">
            <div>
              <div className="font-medium text-[#E8EBF0]">Pause New Execution Admission</div>
              <div className="text-[11px] text-[#737D8C]">
                When enabled, new workforce requests are held in the durable queue without starting new workers.
              </div>
            </div>
            <input
              type="checkbox"
              checked={govPaused}
              onChange={(e) => setGovPaused(e.target.checked)}
              className="w-4 h-4 accent-[#D29A43]"
            />
          </label>

          <button
            onClick={() =>
              void updateAdminGovernor({
                max_concurrent_workforces: govMaxConcurrent,
                max_concurrent_executions_per_user: govPerUserExec,
                max_global_queued_workforces: govGlobalQueue,
                admission_paused: govPaused,
              })
            }
            className="px-4 py-2 rounded-md bg-[#4778D0] hover:bg-[#3b67b8] text-xs font-semibold text-[#E8EBF0]"
          >
            Apply Governor Policy
          </button>
        </div>
      </div>
    );
  }

  // Default Enterprise View for Projects / Workspaces / Integrations / Settings
  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#101216] p-6 text-[#E8EBF0] space-y-6">
      <div className="flex items-center justify-between border-b border-[#343A45] pb-4">
        <div>
          <h1 className="text-base font-semibold text-[#E8EBF0] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#4778D0]" />
            {workforceName} — Project Workspace & Multi-Tenant Overview
          </h1>
          <p className="text-xs text-[#A5ACB8] mt-0.5">{objective}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAuthModalOpen(true)}
            className="px-3 py-1.5 rounded-md bg-[#1B2028] hover:bg-[#22262E] border border-[#343A45] text-xs text-[#E8EBF0] flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5 text-[#299B83]" />
            <span>Switch Workspace / User</span>
          </button>
          <button
            onClick={() => setFactoryModalOpen(true)}
            className="px-3 py-1.5 rounded-md bg-[#4778D0] hover:bg-[#3b67b8] text-xs font-medium text-[#E8EBF0]"
          >
            New Workforce Run
          </button>
        </div>
      </div>

      {/* Workspace Ownership & Infrastructure Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-md bg-[#151920] border border-[#343A45] space-y-1">
          <div className="text-[10px] font-mono uppercase text-[#737D8C]">Isolated Workspace</div>
          <div className="text-xs font-semibold text-[#E8EBF0]">
            {activeWorkspace?.name || 'HQ Workspace'}
          </div>
          <div className="text-[11px] font-mono text-[#299B83]">
            Tenant: {activeWorkspace?.tenant_id || 'ten_usr_director'}
          </div>
        </div>

        <div className="p-4 rounded-md bg-[#151920] border border-[#343A45] space-y-1">
          <div className="text-[10px] font-mono uppercase text-[#737D8C]">Workforce Status</div>
          <div className="text-xs font-semibold text-[#D29A43] font-mono">{workforceStatus}</div>
          <div className="text-[11px] text-[#A5ACB8]">
            {agents.length} AI Employees • {tasks.length} Tasks
          </div>
        </div>

        <div className="p-4 rounded-md bg-[#151920] border border-[#343A45] space-y-1">
          <div className="text-[10px] font-mono uppercase text-[#737D8C]">
            Database & Coordination
          </div>
          <div className="text-xs font-semibold text-[#E8EBF0] flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-[#4778D0]" />
            Neon PostgreSQL + Alembic RLS
          </div>
          <div className="text-[11px] text-[#A5ACB8]">Durable Queue & Lease Recovery</div>
        </div>

        <div className="p-4 rounded-md bg-[#151920] border border-[#343A45] space-y-1">
          <div className="text-[10px] font-mono uppercase text-[#737D8C]">
            Deliverables & Meetings
          </div>
          <div className="text-xs font-semibold text-[#E8EBF0]">
            {artifacts.length} Validated Artifacts • {meetings.length} Meetings
          </div>
          <button
            onClick={() => setSettingsModalOpen(true)}
            className="text-[11px] text-[#4778D0] hover:underline"
          >
            Configure Gemini Free-Tier Gateway →
          </button>
        </div>
      </div>

      {/* Tasks & Deliverables Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-md bg-[#151920] border border-[#343A45] space-y-3">
          <div className="text-xs font-mono uppercase text-[#A5ACB8] flex items-center justify-between">
            <span>Assigned Engineering Tasks ({tasks.length})</span>
            <button
              onClick={() => setActiveAppSection('office')}
              className="text-[11px] text-[#4778D0] hover:underline"
            >
              Inspect in 3D Office →
            </button>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {tasks.map((t) => (
              <div
                key={t.id}
                className="p-3 rounded bg-[#101216] border border-[#343A45] flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-medium text-[#E8EBF0]">{t.title}</div>
                  <div className="text-[11px] text-[#737D8C]">
                    Assigned: {t.assigned_agent_name || 'Specialist'}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#22262E] font-mono text-[10px] text-[#299B83]">
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-md bg-[#151920] border border-[#343A45] space-y-3">
          <div className="text-xs font-mono uppercase text-[#A5ACB8] flex items-center justify-between">
            <span>RBAC & Multi-Tenant Security Controls</span>
            <ShieldCheck className="w-4 h-4 text-[#299B83]" />
          </div>
          <div className="space-y-2 text-xs text-[#A5ACB8]">
            <div className="p-2.5 rounded bg-[#101216] border border-[#343A45] flex items-center justify-between">
              <span>Authenticated Identity</span>
              <span className="font-mono text-[#E8EBF0]">
                {currentUser?.email || 'director@projectforge.ai'}
              </span>
            </div>
            <div className="p-2.5 rounded bg-[#101216] border border-[#343A45] flex items-center justify-between">
              <span>Platform Role / Workspace Role</span>
              <span className="font-mono text-[#299B83]">
                {currentUser?.platform_role || 'PLATFORM_ADMIN'} / OWNER
              </span>
            </div>
            <div className="p-2.5 rounded bg-[#101216] border border-[#343A45] flex items-center justify-between">
              <span>External PR Creation & Default Branch</span>
              <span className="font-mono text-[#D29A43]">APPROVAL GATE REQUIRED</span>
            </div>
            <div className="p-2.5 rounded bg-[#101216] border border-[#343A45] flex items-center justify-between">
              <span>Gemini Free-Tier Rate-Limit Pacer</span>
              <span className="font-mono text-[#299B83]">15 RPM • 250K TPM • 500 RPD</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
