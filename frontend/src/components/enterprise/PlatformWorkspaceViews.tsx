import React, { useEffect, useState } from 'react';
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
  const authToken = useWorldStore((s) => s.authToken);
  const currentUser = useWorldStore((s) => s.currentUser);
  const activeWorkspace = useWorldStore((s) => s.activeWorkspace);
  const hydrateAuthSession = useWorldStore((s) => s.hydrateAuthSession);

  const createArtifact = useWorldStore((s) => s.createArtifact);
  const githubStatus = useWorldStore((s) => s.githubStatus);
  const githubInstallation = useWorldStore((s) => s.githubInstallation);
  const githubError = useWorldStore((s) => s.githubError);
  const githubInstallUrl = useWorldStore((s) => s.githubInstallUrl);
  const githubOAuthConfigured = useWorldStore((s) => s.githubOAuthConfigured);
  const fetchGitHubStatus = useWorldStore((s) => s.fetchGitHubStatus);
  const startGitHubOAuth = useWorldStore((s) => s.startGitHubOAuth);
  const syncGitHubRepos = useWorldStore((s) => s.syncGitHubRepos);
  const syncRepoPulls = useWorldStore((s) => s.syncRepoPulls);
  const disconnectGitHub = useWorldStore((s) => s.disconnectGitHub);
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

  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [branchInput, setBranchInput] = useState('forge/readme-verification');
  const [filePathInput, setFilePathInput] = useState('README.md');
  const [runningBranch, setRunningBranch] = useState(false);
  const [syncingRepos, setSyncingRepos] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

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
  const [govSubmitting, setGovSubmitting] = useState(false);
  const [govFeedback, setGovFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const isPlatformAdmin =
    currentUser?.platform_role === 'PLATFORM_ADMIN' ||
    currentUser?.platform_role === 'PLATFORM_OPERATOR';
  const workspaceRole = (activeWorkspace?.role || '').toUpperCase();
  const workspaceRoleLoading = Boolean(authToken) && !workspaceRole;
  const canManageGitHub = workspaceRole === 'OWNER' || workspaceRole === 'ADMIN';

  useEffect(() => {
    setSelectedRepoId('');
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (activeAppSection === 'admin' && !isPlatformAdmin) {
      setActiveAppSection('office');
    }
    if (activeAppSection === 'github') {
      if (authToken && !activeWorkspace?.role) {
        void hydrateAuthSession();
      }
      void fetchGitHubStatus();
    }
  }, [
    activeAppSection,
    isPlatformAdmin,
    setActiveAppSection,
    fetchGitHubStatus,
    authToken,
    activeWorkspace?.role,
    hydrateAuthSession,
  ]);

  useEffect(() => {
    if (connectedRepositories.length > 0 && !connectedRepositories.some((r) => r.id === selectedRepoId)) {
      setSelectedRepoId(connectedRepositories[0].id);
    }
  }, [connectedRepositories, selectedRepoId]);

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
      await executeRepoBranch(repoId, branchInput, filePathInput);
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
    const selectedRepo =
      connectedRepositories.find((r) => r.id === selectedRepoId) || connectedRepositories[0] || null;

    return (
      <div className="flex-1 h-full overflow-y-auto bg-[#101216] p-6 text-[#E8EBF0] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#343A45] pb-4">
          <div>
            <h1 className="text-base font-semibold text-[#E8EBF0] flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-[#299B83]" />
              GitHub App Integration &amp; Isolated Repository Sandboxes
              <span
                className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                  githubStatus === 'CONNECTED'
                    ? 'bg-[#299B83]/20 text-[#299B83]'
                    : githubStatus === 'CONNECTING'
                    ? 'bg-[#4778D0]/20 text-[#4778D0]'
                    : githubStatus === 'ERROR'
                    ? 'bg-[#C45D62]/20 text-[#C45D62]'
                    : 'bg-[#22262E] text-[#A5ACB8]'
                }`}
              >
                {githubStatus === 'CONNECTED' && githubInstallation
                  ? `CONNECTED (@${githubInstallation.account_login})`
                  : githubStatus === 'CONNECTING'
                  ? 'CONNECTING...'
                  : githubStatus === 'ERROR'
                  ? 'CONNECTION FAILED'
                  : 'NOT CONNECTED'}
              </span>
            </h1>
            <p className="text-xs text-[#A5ACB8] mt-0.5">
              Real GitHub App RS256 authentication, Fernet-encrypted installation tokens, real git clone/commit/push, and GitHub REST API Pull Requests.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {githubStatus === 'CONNECTED' ? (
              <>
                {canManageGitHub && (
                  <button
                    disabled={syncingRepos}
                    onClick={async () => {
                      setSyncingRepos(true);
                      try {
                        await syncGitHubRepos();
                      } finally {
                        setSyncingRepos(false);
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-md bg-[#22262E] hover:bg-[#2d333f] border border-[#343A45] text-xs text-[#E8EBF0] disabled:opacity-50"
                  >
                    {syncingRepos ? 'Syncing...' : 'Refresh Repositories'}
                  </button>
                )}
                {canManageGitHub && (
                  <button
                    onClick={() => void disconnectGitHub()}
                    className="px-2.5 py-1.5 rounded-md bg-[#1B2028] hover:bg-[#C45D62]/20 border border-[#343A45] text-xs text-[#C45D62]"
                  >
                    Disconnect
                  </button>
                )}
              </>
            ) : (
              canManageGitHub && (
                <button
                  disabled={githubStatus === 'CONNECTING' || !githubOAuthConfigured}
                  onClick={() => void startGitHubOAuth('install')}
                  className="px-3.5 py-1.5 rounded-md bg-[#299B83] hover:bg-[#23846f] disabled:opacity-50 text-xs font-medium text-[#E8EBF0]"
                >
                  {githubStatus === 'CONNECTING' ? 'Connecting...' : 'Connect GitHub'}
                </button>
              )
            )}
          </div>
        </div>

        {githubError && (
          <div className="p-3.5 rounded-md bg-[#C45D62]/15 border border-[#C45D62]/40 text-xs text-[#E8EBF0] flex flex-wrap items-center justify-between gap-2">
            <span>{githubError}</span>
            {canManageGitHub && (
              <button
                disabled={githubStatus === 'CONNECTING'}
                onClick={() => void startGitHubOAuth('install')}
                className="px-2.5 py-1 rounded bg-[#22262E] hover:bg-[#2d333f] border border-[#343A45] text-[11px] font-medium text-[#E8EBF0]"
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {githubStatus === 'CONNECTING' && (
          <div className="p-6 rounded-md bg-[#151920] border border-[#4778D0]/40 text-center space-y-2">
            <div className="inline-block w-5 h-5 border-2 border-[#4778D0] border-t-transparent rounded-full animate-spin" />
            <div className="text-sm font-medium text-[#E8EBF0]">Connecting to GitHub...</div>
            <div className="text-xs text-[#A5ACB8]">
              Verifying authorization, installation ownership, and discovering accessible repositories.
            </div>
          </div>
        )}

        {githubInstallation && (
          <div className="p-3 rounded-md bg-[#151920] border border-[#343A45] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="space-y-0.5">
              <div className="text-[#E8EBF0] font-medium">
                Account: <span className="font-mono text-[#299B83]">@{githubInstallation.account_login}</span> ({githubInstallation.account_type}) • Installation #{githubInstallation.installation_id} • {connectedRepositories.length} accessible {connectedRepositories.length === 1 ? 'repository' : 'repositories'}
              </div>
              <div className="text-[11px] font-mono text-[#A5ACB8]">
                Permissions:{' '}
                {Object.entries(githubInstallation.permissions || {})
                  .map(([k, v]) => `${k}:${v}`)
                  .join(' • ') || 'default'}
              </div>
            </div>
            {githubInstallUrl && (
              <a
                href={githubInstallUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded bg-[#22262E] border border-[#343A45] text-[11px] text-[#A5ACB8] hover:text-[#E8EBF0]"
              >
                Manage App on GitHub ↗
              </a>
            )}
          </div>
        )}

        {githubStatus !== 'CONNECTED' && githubStatus !== 'CONNECTING' ? (
          <div className="p-8 rounded-md bg-[#151920] border border-[#343A45] text-center max-w-xl mx-auto space-y-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-[#22262E] border border-[#343A45] flex items-center justify-center text-[#E8EBF0]">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" aria-label="GitHub logo">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
                </svg>
              </div>
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-semibold text-[#E8EBF0]">Connect your GitHub account</h2>
              <p className="text-xs text-[#A5ACB8] leading-relaxed">
                Bring your repositories into PROJECT FORGE. Your agents can inspect code, collaborate on changes, and help you ship faster.
              </p>
            </div>
            {workspaceRoleLoading ? (
              <div className="text-xs text-[#A5ACB8] bg-[#101216] border border-[#343A45] rounded px-3 py-2">
                Verifying workspace permissions...
              </div>
            ) : canManageGitHub ? (
              <div className="space-y-2.5">
                <button
                  disabled={!githubOAuthConfigured}
                  onClick={() => void startGitHubOAuth('install')}
                  className="px-5 py-2.5 rounded-md bg-[#299B83] hover:bg-[#23846f] disabled:opacity-50 text-xs font-semibold text-[#E8EBF0]"
                >
                  Connect GitHub
                </button>
                <div>
                  <button
                    disabled={!githubOAuthConfigured}
                    onClick={() => void startGitHubOAuth('oauth')}
                    className="text-[11px] text-[#737D8C] hover:text-[#A5ACB8] underline disabled:opacity-50"
                  >
                    Already installed the app? Authorize existing installation
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#A5ACB8] bg-[#101216] border border-[#343A45] rounded px-3 py-2">
                Only workspace OWNER or ADMIN members can connect or manage GitHub integrations.
              </div>
            )}
            <div className="pt-3 border-t border-[#343A45] text-[11px] text-[#737D8C] space-y-1">
              <div>Requested permissions: Contents (read &amp; write), Pull requests (read &amp; write), Metadata, Checks &amp; Commit statuses (read).</div>
              <div>Repository access is controlled through GitHub. You choose which accounts and repositories to grant.</div>
            </div>
          </div>
        ) : connectedRepositories.length === 0 ? (
          <div className="p-8 rounded-md bg-[#151920] border border-[#343A45] text-center space-y-3">
            <div className="text-xs text-[#A5ACB8]">
              Your GitHub account is connected, but no repositories are currently accessible to this installation.
            </div>
            <div className="flex items-center justify-center gap-2">
              {canManageGitHub && (
                <button
                  disabled={syncingRepos}
                  onClick={async () => {
                    setSyncingRepos(true);
                    try {
                      await syncGitHubRepos();
                    } finally {
                      setSyncingRepos(false);
                    }
                  }}
                  className="px-4 py-2 rounded-md bg-[#4778D0] hover:bg-[#3b67b8] disabled:opacity-50 text-xs font-semibold text-[#E8EBF0]"
                >
                  {syncingRepos ? 'Refreshing...' : 'Refresh Repositories'}
                </button>
              )}
              {githubInstallUrl && (
                <a
                  href={githubInstallUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-md bg-[#22262E] border border-[#343A45] text-xs font-medium text-[#E8EBF0]"
                >
                  Grant Repository Access on GitHub ↗
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-[#A5ACB8]">Select Repository:</span>
              {connectedRepositories.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => setSelectedRepoId(repo.id)}
                  className={`px-3 py-1.5 rounded-md border text-xs font-mono transition ${
                    selectedRepo?.id === repo.id
                      ? 'bg-[#4778D0]/20 border-[#4778D0] text-[#E8EBF0]'
                      : 'bg-[#151920] border-[#343A45] text-[#A5ACB8] hover:text-[#E8EBF0]'
                  }`}
                >
                  {repo.full_name} ({repo.is_private ? 'Private' : 'Public'})
                </button>
              ))}
            </div>

            {selectedRepo && (
              <div
                key={selectedRepo.id}
                className="p-4 rounded-md bg-[#151920] border border-[#343A45] space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={selectedRepo.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-[#E8EBF0] hover:text-[#4778D0]"
                      >
                        {selectedRepo.full_name} ↗
                      </a>
                      <span className="px-2 py-0.5 rounded bg-[#22262E] border border-[#343A45] font-mono text-[10px] text-[#A5ACB8]">
                        default: {selectedRepo.default_branch} (PROTECTED)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#22262E] border border-[#343A45] font-mono text-[10px] text-[#A5ACB8]">
                        {selectedRepo.is_private ? 'Private' : 'Public'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#737D8C] font-mono mt-1">
                      Branches: {(selectedRepo.repo_metadata?.branches || [selectedRepo.default_branch]).join(', ')}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={filePathInput}
                      onChange={(e) => setFilePathInput(e.target.value)}
                      placeholder="Target file (e.g. README.md)"
                      className="px-2.5 py-1 rounded bg-[#101216] border border-[#343A45] text-xs font-mono text-[#E8EBF0] w-36"
                    />
                    <input
                      value={branchInput}
                      onChange={(e) => setBranchInput(e.target.value)}
                      placeholder="Working branch (e.g. forge/patch)"
                      className="px-2.5 py-1 rounded bg-[#101216] border border-[#343A45] text-xs font-mono text-[#E8EBF0]"
                    />
                    <button
                      disabled={runningBranch}
                      onClick={() => void handleRunBranchWorkflow(selectedRepo.id)}
                      className="px-3 py-1.5 rounded-md bg-[#4778D0] hover:bg-[#3b67b8] disabled:opacity-50 text-xs font-medium text-[#E8EBF0] flex items-center gap-1.5"
                    >
                      <Play className="w-3 h-3" />
                      <span>
                        {runningBranch
                          ? 'Cloning, Testing & Pushing...'
                          : 'Clone, Commit & Push Branch'}
                      </span>
                    </button>
                    <button
                      onClick={() => void syncRepoPulls(selectedRepo.id)}
                      className="px-2.5 py-1.5 rounded-md bg-[#22262E] border border-[#343A45] text-xs text-[#A5ACB8] hover:text-[#E8EBF0]"
                    >
                      Sync PRs
                    </button>
                  </div>
                </div>

                {/* Open Pull Requests from GitHub */}
                {(selectedRepo.repo_metadata?.open_prs || []).length > 0 && (
                  <div className="pt-3 border-t border-[#343A45] space-y-2">
                    <div className="text-[11px] font-mono uppercase text-[#A5ACB8] flex items-center gap-1.5">
                      <GitPullRequest className="w-3.5 h-3.5 text-[#299B83]" />
                      GitHub Pull Requests (Auto-Merge Disabled)
                    </div>
                    <div className="space-y-1.5">
                      {(selectedRepo.repo_metadata.open_prs || []).map((pr) => (
                        <div
                          key={pr.number}
                          className="p-2.5 rounded bg-[#101216] border border-[#343A45] flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <a
                              href={pr.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-[#299B83] hover:underline mr-2"
                            >
                              #{pr.number} ↗
                            </a>
                            <span className="font-medium text-[#E8EBF0]">{pr.title}</span>
                            <span className="ml-2 font-mono text-[10px] text-[#737D8C]">
                              ({pr.head} → {pr.base})
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-[#299B83]/20 text-[#299B83] font-mono text-[10px]">
                            GitHub PR: {pr.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pending Approval Gates */}
        <div className="space-y-3">
          <h2 className="text-xs font-mono uppercase text-[#A5ACB8] flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-[#D29A43]" />
            Internal PR Approval Gates &amp; Unified Git Diffs
          </h2>
          {executions.flatMap((ex) =>
            (ex.approvals || []).map((ap) => ({ ex, ap }))
          ).length === 0 ? (
            <div className="p-4 rounded-md bg-[#151920] border border-[#343A45] text-xs text-[#737D8C]">
              No approval gates yet. Run &ldquo;Clone, Commit &amp; Push Branch&rdquo; to generate a real diff and push a working branch.
            </div>
          ) : (
            executions.map((ex) =>
              (ex.approvals || []).map((ap) => (
                <div
                  key={ap.id}
                  className="p-4 rounded-md bg-[#151920] border border-[#343A45] space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-[#E8EBF0]">{ap.title}</div>
                      <div className="text-[11px] text-[#A5ACB8] mt-0.5">{ap.description}</div>
                      <div className="text-[10px] font-mono text-[#737D8C] mt-1">
                        Branch: {ex.working_branch || 'N/A'} • Execution Status: {ex.status}
                      </div>
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
                      Internal Gate: {ap.status}
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
                        disabled={approvingId === ap.id}
                        onClick={async () => {
                          setApprovingId(ap.id);
                          try {
                            await decideApproval(ex.id, ap.id, 'APPROVED');
                          } finally {
                            setApprovingId(null);
                          }
                        }}
                        className="px-3 py-1.5 rounded bg-[#299B83] hover:bg-[#23846f] disabled:opacity-50 text-xs font-medium text-[#E8EBF0] flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {approvingId === ap.id ? 'Creating GitHub PR...' : 'Approve & Create GitHub PR'}
                        </span>
                      </button>
                      <button
                        disabled={approvingId === ap.id}
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
    if (!isPlatformAdmin) {
      return (
        <div className="flex-1 h-full overflow-y-auto bg-[#101216] p-6 text-[#E8EBF0] flex items-center justify-center">
          <div className="max-w-md w-full p-5 rounded-md bg-[#151920] border border-[#C45D62]/60 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#C45D62]">
              <Lock className="w-4 h-4" />
              Access Denied — Platform Administrator Required
            </div>
            <p className="text-xs text-[#A5ACB8]">
              Your account ({currentUser?.platform_role || 'UNAUTHENTICATED'}) is not authorized to access the Administrator Capacity & Resource Governor Dashboard.
            </p>
            <button
              type="button"
              onClick={() => setActiveAppSection('office')}
              className="px-3 py-1.5 rounded bg-[#22262E] hover:bg-[#2c313c] border border-[#343A45] text-xs font-medium text-[#E8EBF0]"
            >
              Return to 3D Office
            </button>
          </div>
        </div>
      );
    }

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
            ROLE: {currentUser.platform_role}
          </span>
        </div>

        {/* Real-Time Telemetry Cards (Part 18 Specification) */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {[
            { label: 'Authenticated Users', val: systemCapacity?.authenticated_users ?? '—' },
            { label: 'Active Sessions', val: systemCapacity?.active_sessions ?? '—' },
            {
              label: 'Active Executions',
              val: systemCapacity
                ? `${systemCapacity.active_executions ?? 0} / ${systemCapacity.max_concurrent_workforces ?? '—'}`
                : '—',
            },
            {
              label: 'Queued Executions',
              val: systemCapacity
                ? `${systemCapacity.queued_executions ?? 0} (${systemCapacity.queue_utilization_pct ?? 0}%)`
                : '—',
            },
            { label: 'Available Slots', val: systemCapacity?.available_execution_slots ?? '—' },
            { label: 'Active Sandboxes', val: systemCapacity?.active_sandboxes ?? '—' },
            { label: 'API Memory', val: systemCapacity?.api_memory_mb != null ? `${systemCapacity.api_memory_mb} MB` : '—' },
            { label: 'API CPU Time', val: systemCapacity?.api_cpu_seconds != null ? `${systemCapacity.api_cpu_seconds}s` : '—' },
            { label: 'DB Pool Size', val: systemCapacity?.db_pool_size ?? '—' },
            {
              label: 'Artifact Storage',
              val: systemCapacity?.storage_bytes_used != null
                ? `${(systemCapacity.storage_bytes_used / 1024).toFixed(1)} KB`
                : '—',
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

          {govFeedback && (
            <div
              className={`p-2.5 rounded text-xs border ${
                govFeedback.ok
                  ? 'bg-[#299B83]/15 border-[#299B83]/40 text-[#299B83]'
                  : 'bg-[#C45D62]/15 border-[#C45D62]/50 text-[#E8EBF0]'
              }`}
            >
              {govFeedback.message}
            </div>
          )}

          <button
            disabled={govSubmitting}
            onClick={async () => {
              setGovSubmitting(true);
              setGovFeedback(null);
              const result = await updateAdminGovernor({
                max_concurrent_workforces: govMaxConcurrent,
                max_concurrent_executions_per_user: govPerUserExec,
                max_global_queued_workforces: govGlobalQueue,
                admission_paused: govPaused,
              });
              setGovSubmitting(false);
              setGovFeedback(
                result.ok
                  ? { ok: true, message: 'Resource Governor policy updated.' }
                  : { ok: false, message: result.error || 'Failed to update Resource Governor policy.' }
              );
            }}
            className="px-4 py-2 rounded-md bg-[#4778D0] hover:bg-[#3b67b8] disabled:opacity-50 text-xs font-semibold text-[#E8EBF0]"
          >
            {govSubmitting ? 'Applying...' : 'Apply Governor Policy'}
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
            {activeWorkspace?.name || 'No Workspace Selected'}
          </div>
          <div className="text-[11px] font-mono text-[#299B83]">
            Tenant: {activeWorkspace?.tenant_id || '—'}
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
                {currentUser?.email || 'Not signed in'}
              </span>
            </div>
            <div className="p-2.5 rounded bg-[#101216] border border-[#343A45] flex items-center justify-between">
              <span>Platform Role / Workspace Role</span>
              <span className="font-mono text-[#299B83]">
                {currentUser ? `${currentUser.platform_role} / OWNER` : 'UNAUTHENTICATED'}
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
