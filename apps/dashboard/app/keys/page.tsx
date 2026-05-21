'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '../../components/Nav';
import { apiGet, apiPost, apiDelete, AuthError, type ApiKey } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';

export default function KeysPage() {
  useRequireAuth();
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const data = await apiGet<{ keys: ApiKey[] }>('/v1/keys');
      setKeys(data.keys);
    } catch (e) {
      if (e instanceof AuthError) router.replace('/login');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createKey() {
    if (!newEmail.trim()) return;
    setCreating(true);
    try {
      const result = await apiPost<{ api_key: string }>('/v1/keys', { email: newEmail.trim() });
      setNewKey(result.api_key);
      setNewEmail('');
      load();
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    if (!confirm('Revoke this key? Any agents using it will stop working.')) return;
    await apiDelete(`/v1/keys/${id}`);
    load();
  }

  function copyKey() {
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-2xl mx-auto px-6 py-10 space-y-4">
        <h1 className="text-xl font-semibold">API Keys</h1>

        {/* New key revealed */}
        {newKey && (
          <div className="backdrop-blur-md bg-violet-600/10 border border-violet-500/30 rounded-2xl p-5 space-y-3">
            <p className="text-xs text-zinc-400">New key — copy it now, it won't be shown again</p>
            <p className="font-mono text-sm break-all text-white">{newKey}</p>
            <div className="flex gap-2">
              <button
                onClick={copyKey}
                className="btn-ghost text-xs px-3 py-1.5"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <button
                onClick={() => setNewKey('')}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Create key form */}
        <div className="glass-card p-5 space-y-3">
          <p className="text-sm font-medium text-white">Create new key</p>
          <label className="block">
            <span className="sr-only">Email address</span>
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createKey()}
                placeholder="email@example.com"
                autoComplete="email"
                className="glass-input flex-1"
              />
              <button
                onClick={createKey}
                disabled={!newEmail.trim() || creating}
                className="btn-primary px-5 py-2.5"
              >
                {creating ? '…' : 'Create'}
              </button>
            </div>
          </label>
        </div>

        {/* Keys table */}
        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="p-6 animate-pulse h-20" />
          ) : keys.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-zinc-500 text-sm">No keys yet.</p>
              <p className="text-zinc-600 text-xs mt-1">Create one above to get started.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-zinc-500 text-xs">
                  <th className="text-left px-5 py-3">Key</th>
                  <th className="text-left px-5 py-3">Env</th>
                  <th className="text-left px-5 py-3">Tier</th>
                  <th className="text-left px-5 py-3">Created</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                    <td className="px-5 py-3 font-mono text-zinc-300">{k.prefix}…</td>
                    <td className="px-5 py-3 text-zinc-400">{k.env}</td>
                    <td className="px-5 py-3 capitalize text-zinc-400">{k.tier}</td>
                    <td className="px-5 py-3 text-zinc-400">{new Date(k.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full ${
                        k.active
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : 'bg-white/5 text-zinc-500 border border-white/10'
                      }`}>
                        {k.active ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {k.active && (
                        <button
                          onClick={() => revokeKey(k.id)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors focus-visible:ring-2 focus-visible:ring-red-500 rounded"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
