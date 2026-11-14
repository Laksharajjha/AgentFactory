import React, { useState } from 'react';
import { KeyRound, LogIn, ShieldCheck, UserPlus, X } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { useWorldStore } from '../../state/worldStore';

export const AuthModal: React.FC = () => {
  const open = useWorldStore((s) => s.authModalOpen);
  const setOpen = useWorldStore((s) => s.setAuthModalOpen);
  const currentUser = useWorldStore((s) => s.currentUser);
  const activeWorkspace = useWorldStore((s) => s.activeWorkspace);
  const setAuthSession = useWorldStore((s) => s.setAuthSession);
  const logoutSession = useWorldStore((s) => s.logoutSession);

  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleTitle, setRoleTitle] = useState('Principal Systems Engineer');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body =
        mode === 'register'
          ? { name, email, password, role_title: roleTitle }
          : { email, password };
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || `Authentication failed (${res.status})`);
      }
      setAuthSession(data.access_token, data.user, data.workspace);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickOAuth = async (provider: 'google' | 'github') => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/oauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          email: `${provider}.engineer@projectforge.ai`,
          name: `${provider === 'github' ? 'GitHub' : 'Google'} Verified Engineer`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'OAuth failed');
      setAuthSession(data.access_token, data.user, data.workspace);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#151920] border border-[#343A45] rounded-md shadow-2xl overflow-hidden text-[#E8EBF0]"
      >
        <div className="px-4 py-3 border-b border-[#343A45] bg-[#101216] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#299B83]" />
            <span className="text-xs font-semibold tracking-wide">
              IDENTITY & MULTI-TENANT WORKSPACE ACCESS
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-[#22262E] text-[#737D8C] hover:text-[#E8EBF0]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs">
          {/* Active Session Summary */}
          {currentUser && activeWorkspace && (
            <div className="p-3 rounded-md bg-[#1B2028] border border-[#343A45] flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase text-[#737D8C]">
                  Active Authenticated Workspace
                </div>
                <div className="font-semibold text-[#E8EBF0] mt-0.5">{currentUser.name}</div>
                <div className="text-[11px] text-[#A5ACB8] font-mono">
                  {activeWorkspace.name} ({activeWorkspace.id})
                </div>
              </div>
              <button
                type="button"
                onClick={() => void logoutSession()}
                className="px-2.5 py-1 rounded bg-[#22262E] hover:bg-[#C45D62]/20 border border-[#343A45] text-[#A5ACB8] hover:text-[#E8EBF0] text-[11px]"
              >
                Switch / Logout
              </button>
            </div>
          )}

          {/* Mode Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-md bg-[#101216] border border-[#343A45]">
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1.5 ${
                mode === 'register'
                  ? 'bg-[#22262E] text-[#E8EBF0] border border-[#343A45]'
                  : 'text-[#737D8C] hover:text-[#A5ACB8]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Create Account
            </button>
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1.5 ${
                mode === 'login'
                  ? 'bg-[#22262E] text-[#E8EBF0] border border-[#343A45]'
                  : 'text-[#737D8C] hover:text-[#A5ACB8]'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
          </div>

          {error && (
            <div className="p-2.5 rounded bg-[#C45D62]/15 border border-[#C45D62]/50 text-[#E8EBF0] text-[11px]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-[11px] text-[#A5ACB8] mb-1">Full Name</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Elena Vance"
                    className="w-full px-3 py-1.5 rounded-md bg-[#101216] border border-[#343A45] text-[#E8EBF0] focus:outline-none focus:border-[#4778D0]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#A5ACB8] mb-1">Engineering Role</label>
                  <input
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md bg-[#101216] border border-[#343A45] text-[#E8EBF0] focus:outline-none focus:border-[#4778D0]"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] text-[#A5ACB8] mb-1">Work Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="engineer@company.com"
                className="w-full px-3 py-1.5 rounded-md bg-[#101216] border border-[#343A45] text-[#E8EBF0] focus:outline-none focus:border-[#4778D0]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#A5ACB8] mb-1">Password</label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-1.5 rounded-md bg-[#101216] border border-[#343A45] text-[#E8EBF0] focus:outline-none focus:border-[#4778D0]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-md bg-[#4778D0] hover:bg-[#3b67b8] text-[#E8EBF0] font-semibold transition"
            >
              {loading
                ? 'Provisioning Workspace...'
                : mode === 'register'
                ? 'Register & Provision Isolated Workspace'
                : 'Sign In to Workspace'}
            </button>
          </form>

          <div className="pt-2 border-t border-[#343A45] grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handleQuickOAuth('github')}
              className="py-1.5 px-3 rounded-md bg-[#1B2028] hover:bg-[#22262E] border border-[#343A45] text-[#E8EBF0] text-[11px] font-medium flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-3 h-3 text-[#299B83]" /> GitHub SSO
            </button>
            <button
              type="button"
              onClick={() => void handleQuickOAuth('google')}
              className="py-1.5 px-3 rounded-md bg-[#1B2028] hover:bg-[#22262E] border border-[#343A45] text-[#E8EBF0] text-[11px] font-medium flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-3 h-3 text-[#4778D0]" /> Google SSO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
