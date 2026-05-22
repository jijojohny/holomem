'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '../../components/DashboardShell';
import { apiGet, apiPost, apiDelete, AuthError, type ApiKey, type Account } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';
import { useToast } from '../../components/Toast';

type Env = 'live' | 'test';

/* ─── Stat card ────────────────────────────────────────────────────── */
function StatCard({
  label, value, sub, subColor, icon,
}: {
  label: string; value: string | number; sub?: string; subColor?: string; icon: React.ReactNode;
}) {
  return (
    <div className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-zinc-500">{label}</p>
        <span className="text-zinc-600">{icon}</span>
      </div>
      <p className="text-[2rem] font-bold text-white leading-none tracking-tight">{value}</p>
      {sub && <p className="text-[11px] font-semibold mt-1.5" style={{ color: subColor ?? 'rgba(161,161,170,0.8)' }}>{sub}</p>}
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────── */
export default function KeysPage() {
  useRequireAuth();
  const router = useRouter();
  const { toast, confirm } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [env, setEnv] = useState<Env>('live');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const [keysData, accountData] = await Promise.all([
        apiGet<{ keys: ApiKey[] }>('/v1/keys'),
        apiGet<Account>('/v1/account'),
      ]);
      setKeys(keysData.keys);
      setAccount(accountData);
    } catch (e) {
      if (e instanceof AuthError) router.replace('/login');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createKey() {
    setCreating(true);
    try {
      const result = await apiPost<{ api_key: string }>('/v1/keys', { env });
      setNewKey(result.api_key);
      toast(`${env === 'live' ? 'Live' : 'Test'} key created`, 'success');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create key', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    const ok = await confirm({
      title: 'Revoke this key?',
      body: 'Any agents using it will stop working immediately.',
      confirm: 'Revoke',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiDelete(`/v1/keys/${id}`);
      toast('Key revoked', 'success');
      load();
    } catch {
      toast('Failed to revoke key', 'error');
    }
  }

  function copyKey() {
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const active = keys.filter((k) => k.active);
  const liveKeys = active.filter((k) => k.env === 'live');
  const testKeys = active.filter((k) => k.env === 'test');
  const lastCreated = keys[0]
    ? new Date(keys[0].created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—';

  return (
    <DashboardShell>
      <div className="p-6 space-y-5">

        {/* ── Page header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-white tracking-tight">API Keys</h1>
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-zinc-600 mt-0.5">
              Security &amp; Access Management
            </p>
          </div>
          <button
            onClick={createKey}
            disabled={creating}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold tracking-[0.1em] uppercase px-4 py-2.5 rounded-lg transition-all hover:shadow-[0_0_20px_rgba(124,58,237,0.35)] focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {creating ? 'Creating…' : 'Deploy Key'}
          </button>
        </div>

        {/* ── Stat cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Total Keys"
            value={loading ? '—' : keys.length}
            sub="All time"
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="6" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M9 8h6M12 6.5V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            }
          />
          <StatCard
            label="Active Keys"
            value={loading ? '—' : active.length}
            sub={active.length > 0 ? 'Operational' : 'None active'}
            subColor="#34d399"
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 1.5 2 4v4.5c0 3 2.67 5.3 6 6 3.33-.7 6-3 6-6V4L8 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M5.5 8 7 9.5 10.5 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
          />
          <StatCard
            label="Live / Test"
            value={`${liveKeys.length} / ${testKeys.length}`}
            sub="Key environments"
            subColor="rgba(167,139,250,0.9)"
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8a5 5 0 1 0 10 0A5 5 0 0 0 3 8Z" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            }
          />
          <StatCard
            label="Last Created"
            value={loading ? '—' : lastCreated}
            sub="Most recent key"
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M2 7h12M5 1.5V4M11 1.5V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            }
          />
        </div>

        {/* ── New key revealed ─────────────────────────────────────── */}
        {newKey && (
          <div
            className="rounded-2xl p-5"
            style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.2)' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <circle cx="7" cy="7" r="6" stroke="#34d399" strokeWidth="1.3"/>
                  <path d="M4 7l2.5 2.5L10 4.5" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p className="text-[11px] font-bold tracking-[0.1em] uppercase text-emerald-400">Key Created — Save Now</p>
              </div>
              <button
                onClick={() => setNewKey('')}
                className="text-zinc-600 hover:text-zinc-400 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
                aria-label="Dismiss"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <p className="font-mono text-[13px] text-white break-all bg-white/[0.04] rounded-lg px-4 py-3 mb-3" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
              {newKey}
            </p>
            <p className="text-[10px] text-zinc-500 mb-3">This key is shown only once. Store it in a secure environment variable.</p>
            <button
              onClick={copyKey}
              className="flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] uppercase text-white px-4 py-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-violet-400"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <rect x="1" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M3 3V2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H9" stroke="currentColor" strokeWidth="1.3"/>
              </svg>
              {copied ? '✓ Copied to clipboard' : 'Copy key'}
            </button>
          </div>
        )}

        {/* ── Create key form ──────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="text-[14px] font-bold text-white">Deploy New Key</h2>
            <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-zinc-600 mt-0.5">Issue access credential</p>
          </div>
          <div className="p-5 space-y-4">
            {/* Account context */}
            <div
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-zinc-600 shrink-0" aria-hidden="true">
                <rect x="1" y="3" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="m1 3.5 5.5 4L12 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
              <span className="text-[12px] font-medium text-zinc-400 flex-1">
                {account ? account.email : <span className="text-zinc-700 animate-pulse">Loading account…</span>}
              </span>
              <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-zinc-700">Issuing to</span>
            </div>

            <div className="flex gap-3">
              {/* Env toggle */}
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                {(['live', 'test'] as Env[]).map((e) => (
                  <button
                    key={e}
                    onClick={() => setEnv(e)}
                    className="px-4 py-2.5 text-[11px] font-bold tracking-[0.1em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-violet-500"
                    style={{
                      background: env === e ? 'rgba(124,58,237,0.2)' : 'transparent',
                      color: env === e ? '#a78bfa' : 'rgba(113,113,122,1)',
                      borderRight: e === 'live' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>

              {/* Submit */}
              <button
                onClick={createKey}
                disabled={creating}
                className="flex flex-1 items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold tracking-[0.1em] uppercase px-6 py-2.5 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                {creating ? (
                  <svg className="animate-spin" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="14 8" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                )}
                {creating ? 'Creating…' : 'Create Key'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Keys table ───────────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="text-[14px] font-bold text-white">Active Credentials</h2>
            <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-zinc-600">
              {keys.length} Total
            </span>
          </div>

          {/* Column headers */}
          {!loading && keys.length > 0 && (
            <div
              className="grid px-5 py-2.5"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1.2fr 1fr 80px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            >
              {['Key Prefix', 'Environment', 'Tier', 'Issued', 'Status', ''].map((h) => (
                <p key={h} className="text-[9px] font-bold tracking-[0.18em] uppercase text-zinc-600">{h}</p>
              ))}
            </div>
          )}

          {/* Rows */}
          {loading ? (
            <div className="space-y-0">
              {[1, 2, 3].map((i) => (
                <div key={i} className="px-5 py-4 flex gap-4 items-center animate-pulse" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="h-3 rounded bg-white/[0.06] flex-1" />
                  <div className="h-3 rounded bg-white/[0.06] w-16" />
                  <div className="h-3 rounded bg-white/[0.06] w-12" />
                  <div className="h-3 rounded bg-white/[0.06] w-20" />
                  <div className="h-3 rounded bg-white/[0.06] w-14" />
                </div>
              ))}
            </div>
          ) : keys.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <circle cx="8" cy="10" r="4" stroke="rgba(167,139,250,0.7)" strokeWidth="1.5"/>
                  <path d="M12 10h7M16 8v2" stroke="rgba(167,139,250,0.7)" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="text-[13px] font-semibold text-zinc-400">No keys deployed</p>
              <p className="text-[11px] text-zinc-600 mt-1">Enter an email above to create your first access credential.</p>
            </div>
          ) : (
            keys.map((k, i) => (
              <div
                key={k.id}
                className="grid items-center px-5 py-3.5 transition-colors hover:bg-white/[0.02] group"
                style={{
                  gridTemplateColumns: '2fr 1fr 1fr 1.2fr 1fr 80px',
                  borderBottom: i < keys.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                {/* Key prefix */}
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.2)' }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <circle cx="4" cy="5" r="2" stroke="rgba(167,139,250,0.8)" strokeWidth="1.2"/>
                      <path d="M6 5h3.5M8 4V5" stroke="rgba(167,139,250,0.8)" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <span className="font-mono text-[12px] text-zinc-300">{k.prefix}···</span>
                </div>

                {/* Env badge */}
                <span
                  className="inline-flex items-center w-fit px-2 py-0.5 rounded text-[9px] font-bold tracking-wide"
                  style={k.env === 'live'
                    ? { background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }
                    : { background: 'rgba(113,113,122,0.15)', color: '#a1a1aa', border: '1px solid rgba(113,113,122,0.25)' }
                  }
                >
                  {k.env === 'live' ? '● LIVE' : '○ TEST'}
                </span>

                {/* Tier */}
                <span className="text-[11px] font-semibold capitalize text-zinc-500">{k.tier}</span>

                {/* Created */}
                <span className="text-[11px] font-mono text-zinc-500">
                  {new Date(k.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                </span>

                {/* Status */}
                <div className="flex items-center gap-1.5">
                  {k.active ? (
                    <>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <circle cx="5" cy="5" r="4.5" stroke="#34d399" strokeWidth="1"/>
                        <path d="M2.5 5l2 2 3-3" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-[10px] font-bold text-emerald-400">Active</span>
                    </>
                  ) : (
                    <>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <circle cx="5" cy="5" r="4.5" stroke="#71717a" strokeWidth="1"/>
                        <path d="M3 3l4 4M7 3 3 7" stroke="#71717a" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                      <span className="text-[10px] font-bold text-zinc-600">Revoked</span>
                    </>
                  )}
                </div>

                {/* Revoke action */}
                <div className="flex justify-end">
                  {k.active && (
                    <button
                      onClick={() => revokeKey(k.id)}
                      className="opacity-0 group-hover:opacity-100 text-[10px] font-bold tracking-[0.08em] uppercase text-red-400 hover:text-red-300 transition-all px-2.5 py-1 rounded-md focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:opacity-100"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Security notice ──────────────────────────────────────── */}
        <div
          className="flex items-start gap-3 rounded-xl px-5 py-4"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
            <path d="M7 1.5 1.5 4v4a6 6 0 0 0 5.5 5.5A6 6 0 0 0 12.5 8V4L7 1.5Z" stroke="rgba(113,113,122,0.7)" strokeWidth="1.3" strokeLinejoin="round"/>
            <path d="M7 5v3M7 9.5h.01" stroke="rgba(113,113,122,0.7)" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <p className="text-[11px] text-zinc-600 leading-relaxed">
            API keys grant full access to your memory mesh. Store them in environment variables, never in source code. Rotate keys regularly and revoke any that may be compromised.
          </p>
        </div>

      </div>
    </DashboardShell>
  );
}
