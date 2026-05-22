'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '../../components/DashboardShell';
import { apiGet, apiDelete, AuthError, clearApiKey, type Account, type ApiKey } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';
import { useToast } from '../../components/Toast';

export default function SettingsPage() {
  useRequireAuth();
  const router = useRouter();
  const { toast, confirm } = useToast();

  const [account, setAccount] = useState<Account | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    Promise.all([
      apiGet<Account>('/v1/account'),
      apiGet<{ keys: ApiKey[] }>('/v1/keys').then((d) => d.keys),
    ])
      .then(([a, k]) => { setAccount(a); setKeys(k); })
      .catch((e) => { if (e instanceof AuthError) router.replace('/login'); })
      .finally(() => setLoading(false));
  }, [router]);

  async function revokeAllKeys() {
    const ok = await confirm({
      title: 'Revoke all API keys?',
      body: 'Every active key will stop working immediately. Any agents using them will lose access. You will be signed out.',
      confirm: 'Revoke all',
      danger: true,
    });
    if (!ok) return;

    setRevoking(true);
    try {
      const activeKeys = keys.filter((k) => k.active);
      await Promise.all(activeKeys.map((k) => apiDelete(`/v1/keys/${k.id}`)));
      toast('All keys revoked. Signing out…', 'success');
      setTimeout(() => {
        clearApiKey();
        router.replace('/login');
      }, 1500);
    } catch {
      toast('Failed to revoke all keys', 'error');
      setRevoking(false);
    }
  }

  const activeCount = keys.filter((k) => k.active).length;
  const memberSince = account
    ? new Date(account.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  return (
    <DashboardShell>
      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <h1 className="text-xl font-semibold">Settings</h1>

        {loading ? (
          <div className="space-y-4">
            <div className="glass-card p-6 animate-pulse h-28" />
            <div className="glass-card p-6 animate-pulse h-20" />
          </div>
        ) : (
          <>
            {/* Account info */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-sm font-medium text-white">Account</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Email</p>
                  <p className="text-sm text-zinc-200">{account?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Member since</p>
                  <p className="text-sm text-zinc-200">{memberSince}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Active API keys</p>
                  <p className="text-sm text-zinc-200">{activeCount}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Plan</p>
                  <p className="text-sm text-zinc-200 capitalize">{keys[0]?.tier ?? 'free'}</p>
                </div>
              </div>
            </div>

            {/* Preferences */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-sm font-medium text-white">API Keys</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-300">{activeCount} active key{activeCount !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Manage individual keys on the API Keys page</p>
                </div>
                <a
                  href="/keys"
                  className="btn-ghost text-xs px-3 py-1.5"
                >
                  Manage →
                </a>
              </div>
            </div>

            {/* Danger zone */}
            <div className="backdrop-blur-md bg-red-500/5 border border-red-500/20 rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-medium text-red-400">Danger zone</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-300">Revoke all API keys</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Immediately disables all {activeCount} active key{activeCount !== 1 ? 's' : ''}. Cannot be undone.
                  </p>
                </div>
                <button
                  onClick={revokeAllKeys}
                  disabled={revoking || activeCount === 0}
                  className="px-4 py-2 text-xs font-medium bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  {revoking ? 'Revoking…' : 'Revoke all'}
                </button>
              </div>
            </div>
          </>
        )}
      </main>
  </DashboardShell>
  );
}
