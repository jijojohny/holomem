'use client';

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DashboardShell from '../../components/DashboardShell';
import { apiGet, apiDelete, apiPatch, AuthError, type MemoryEntry } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';
import { useToast } from '../../components/Toast';

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function ttlRemaining(expiresAt: string): { label: string; pct: number; urgent: boolean; expired: boolean } {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { label: 'Expired', pct: 0, urgent: true, expired: true };
  const BASELINE = 30 * 24 * 60 * 60 * 1000;
  const pct = Math.min(100, (ms / BASELINE) * 100);
  const urgent = ms < 60 * 60 * 1000;
  const s = Math.floor(ms / 1000);
  if (s < 60) return { label: `${s}s`, pct, urgent, expired: false };
  const m = Math.floor(s / 60);
  if (m < 60) return { label: `${m}m`, pct, urgent, expired: false };
  const h = Math.floor(m / 60);
  if (h < 24) return { label: `${h}h`, pct, urgent, expired: false };
  return { label: `${Math.floor(h / 24)}d`, pct, urgent: false, expired: false };
}

function shortKey(key: string): string {
  return key.length > 22 ? `${key.slice(0, 11)}…${key.slice(-7)}` : key;
}

function shortSession(id: string): string {
  return id.length > 14 ? `${id.slice(0, 7)}…${id.slice(-5)}` : id;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function exportCsv(memories: MemoryEntry[]) {
  const header = 'entity_key,session_id,agent_id,ttl_tier,created_at,expires_at';
  const rows = memories.map((m) =>
    [m.entity_key, m.session_id, m.agent_id ?? '', m.ttl_tier, m.created_at, m.expires_at]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `holomem-memories-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Tier config ─────────────────────────────────────────────────────── */
type TierFilter = 'all' | 'working' | 'episodic' | 'persistent';

const TIER = {
  working:    { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.22)',  label: 'WORKING',    dot: '#fbbf24' },
  episodic:   { color: '#38bdf8', bg: 'rgba(56,189,248,0.1)',   border: 'rgba(56,189,248,0.22)',  label: 'EPISODIC',   dot: '#38bdf8' },
  persistent: { color: '#34d399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.22)',  label: 'PERSISTENT', dot: '#34d399' },
} as const;

const TIER_FALLBACK = { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.22)', label: 'UNKNOWN', dot: '#a78bfa' };

/* ─── Stat card ───────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, accent, icon }: {
  label: string; value: string; sub?: string; accent?: string; icon: React.ReactNode;
}) {
  return (
    <div className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-zinc-500">{label}</p>
        <span style={{ color: accent ?? 'rgba(113,113,122,0.7)' }}>{icon}</span>
      </div>
      <p className="text-[2rem] font-bold text-white leading-none tracking-tight mb-1">{value}</p>
      {sub && <p className="text-[11px] font-semibold text-zinc-600">{sub}</p>}
    </div>
  );
}

/* ─── Row skeleton ────────────────────────────────────────────────────── */
function RowSkeleton() {
  return (
    <div
      className="grid items-center px-5 py-3.5 gap-4 animate-pulse"
      style={{ gridTemplateColumns: '1.8fr 1.2fr 1fr 1fr 1fr 1.2fr 44px 44px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      {[90, 70, 60, 65, 45, 80].map((w, i) => (
        <div key={i} className="h-3 rounded" style={{ width: `${w}%`, background: 'rgba(255,255,255,0.05)' }} />
      ))}
      <div className="h-5 w-8 rounded bg-white/[0.03] justify-self-end" />
      <div className="h-5 w-8 rounded bg-white/[0.03] justify-self-end" />
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────── */
export default function MemoriesPage() {
  return (
    <Suspense>
      <MemoriesContent />
    </Suspense>
  );
}

function MemoriesContent() {
  useRequireAuth();
  const router = useRouter();
  const params = useSearchParams();
  const { toast, confirm } = useToast();

  const sessionFilter = params.get('session_id') ?? '';
  const agentFilterParam = params.get('agent_id') ?? '';
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionInput, setSessionInput] = useState(sessionFilter);
  const [agentInput, setAgentInput] = useState(agentFilterParam);
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pinning, setPinning] = useState<string | null>(null);

  const load = useCallback(async (sid: string, aid: string) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (sid) qs.set('session_id', sid);
      if (aid) qs.set('agent_id', aid);
      const url = `/v1/memories${qs.toString() ? `?${qs.toString()}` : ''}`;
      const data = await apiGet<{ memories: MemoryEntry[] }>(url);
      setMemories(data.memories);
    } catch (e) {
      if (e instanceof AuthError) router.replace('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(sessionFilter, agentFilterParam); }, [sessionFilter, agentFilterParam, load]);

  function applyFilter() {
    const sid = sessionInput.trim();
    const aid = agentInput.trim();
    const qs = new URLSearchParams();
    if (sid) qs.set('session_id', sid);
    if (aid) qs.set('agent_id', aid);
    router.push(qs.toString() ? `/memories?${qs.toString()}` : '/memories');
  }

  const displayed = useMemo(() => {
    return memories.filter((m) => {
      if (tierFilter !== 'all' && m.ttl_tier !== tierFilter) return false;
      return true;
    });
  }, [memories, tierFilter]);

  async function deleteMemory(key: string) {
    const ok = await confirm({
      title: 'Delete memory node?',
      body: 'This soft-deletes the index entry. On-chain data expires via TTL.',
      confirm: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setDeleting(key);
    try {
      await apiDelete(`/v1/memories/${key}`);
      setMemories((m) => m.filter((x) => x.entity_key !== key));
      toast('Memory node deleted', 'success');
    } catch {
      toast('Failed to delete', 'error');
    } finally {
      setDeleting(null);
    }
  }

  async function togglePin(key: string, currentlyPinned: boolean) {
    setPinning(key);
    try {
      const result = await apiPatch<{ entity_key: string; pinned: boolean }>(`/v1/memories/${key}`, { pinned: !currentlyPinned });
      setMemories((m) => m.map((x) => x.entity_key === key ? { ...x, pinned: result.pinned } : x));
      toast(result.pinned ? 'Memory pinned' : 'Memory unpinned', 'success');
    } catch {
      toast('Failed to update pin', 'error');
    } finally {
      setPinning(null);
    }
  }

  function clearAll() {
    setSessionInput('');
    setAgentInput('');
    setTierFilter('all');
    router.push('/memories');
  }

  const hasActiveFilter = sessionFilter || agentFilterParam || tierFilter !== 'all';
  const tierCounts = useMemo(() => memories.reduce<Record<string, number>>((a, m) => {
    a[m.ttl_tier] = (a[m.ttl_tier] ?? 0) + 1;
    return a;
  }, {}), [memories]);

  return (
    <DashboardShell>
      <div className="p-6 space-y-5">

        {/* ── Page header ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-white tracking-tight">Memory Mesh</h1>
            <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-zinc-600 mt-0.5">
              Encrypted On-Chain Node Registry
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(sessionFilter, agentFilterParam)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold tracking-[0.1em] uppercase text-zinc-400 hover:text-zinc-200 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              aria-label="Refresh"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M10 6A4 4 0 1 1 6 2M6 2l2-2M6 2l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Refresh
            </button>
            {memories.length > 0 && (
              <button
                onClick={() => { exportCsv(displayed); toast('Exported to CSV', 'success'); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold tracking-[0.1em] uppercase text-zinc-400 hover:text-zinc-200 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M6 1v7M3 5l3 3 3-3M1 9v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Export CSV
              </button>
            )}
          </div>
        </div>

        {/* ── Stat cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Total Nodes"
            value={loading ? '—' : memories.length.toString()}
            sub={loading ? '' : displayed.length !== memories.length ? `${displayed.length} visible` : 'all nodes loaded'}
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 1.5C4.41 1.5 1.5 4.41 1.5 8S4.41 14.5 8 14.5 14.5 11.59 14.5 8 11.59 1.5 8 1.5Z" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M1.5 8h13M8 1.5C6.5 3.5 5.5 5.6 5.5 8s1 4.5 2.5 6.5M8 1.5C9.5 3.5 10.5 5.6 10.5 8s-1 4.5-2.5 6.5" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
            }
          />
          <StatCard
            label="Working"
            value={loading ? '—' : (tierCounts['working'] ?? 0).toString()}
            sub="short-lived memories"
            accent="#fbbf24"
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M8 4.5V8l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            }
          />
          <StatCard
            label="Episodic"
            value={loading ? '—' : (tierCounts['episodic'] ?? 0).toString()}
            sub="session-scoped memories"
            accent="#38bdf8"
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M5 7h6M5 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            }
          />
          <StatCard
            label="Persistent"
            value={loading ? '—' : (tierCounts['persistent'] ?? 0).toString()}
            sub="long-term memory"
            accent="#34d399"
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M14 4 8 1.5 2 4v4.5c0 3 2.67 5.3 6 6 3.33-.7 6-3 6-6V4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M5.5 8 7 9.5 10.5 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
          />
        </div>

        {/* ── Filter bar ──────────────────────────────────────────── */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex flex-wrap items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {/* Session ID input */}
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-zinc-700 shrink-0" aria-hidden="true">
                <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="m8 8 2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={sessionInput}
                onChange={(e) => setSessionInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
                placeholder="FILTER BY SESSION ID..."
                className="flex-1 bg-transparent text-[11px] font-semibold tracking-[0.08em] text-zinc-300 placeholder-zinc-700 focus:outline-none font-mono"
                aria-label="Filter by session ID"
              />
            </div>

            {/* Agent input */}
            <div className="flex items-center gap-2 w-44">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-zinc-700 shrink-0" aria-hidden="true">
                <circle cx="6" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M2 11c0-2.21 1.79-4 4-4s4 1.79 4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={agentInput}
                onChange={(e) => setAgentInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
                placeholder="AGENT ID..."
                className="flex-1 bg-transparent text-[11px] font-semibold tracking-[0.08em] text-zinc-300 placeholder-zinc-700 focus:outline-none"
                aria-label="Filter by agent"
              />
            </div>

            {/* Apply + clear */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={applyFilter}
                className="px-4 py-1.5 rounded-lg text-[10px] font-bold tracking-[0.12em] uppercase text-white transition-colors focus-visible:ring-2 focus-visible:ring-violet-500"
                style={{ background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(124,58,237,0.45)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.45)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.3)'; }}
              >
                Apply
              </button>
              {hasActiveFilter && (
                <button
                  onClick={clearAll}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-[0.12em] uppercase text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Tier pills row */}
          <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
            <span className="text-[9px] font-bold tracking-[0.16em] uppercase text-zinc-700 mr-1">TIER</span>
            {(['all', 'working', 'episodic', 'persistent'] as TierFilter[]).map((t) => {
              const cfg = t === 'all' ? null : TIER[t];
              const active = tierFilter === t;
              return (
                <button
                  key={t}
                  onClick={() => setTierFilter(t)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-bold tracking-[0.12em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-violet-500"
                  style={{
                    background: active
                      ? (cfg ? cfg.bg : 'rgba(255,255,255,0.08)')
                      : 'rgba(255,255,255,0.03)',
                    border: active
                      ? `1px solid ${cfg ? cfg.border : 'rgba(255,255,255,0.2)'}`
                      : '1px solid rgba(255,255,255,0.06)',
                    color: active
                      ? (cfg ? cfg.color : 'rgba(255,255,255,0.8)')
                      : 'rgba(113,113,122,0.7)',
                  }}
                >
                  {cfg && (
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: active ? cfg.dot : 'rgba(113,113,122,0.5)' }} />
                  )}
                  {t === 'all' ? 'All' : cfg!.label}
                  {t !== 'all' && !loading && (
                    <span
                      className="ml-0.5 px-1 py-0.5 rounded text-[8px] font-black"
                      style={{
                        background: active ? (cfg ? `${cfg.color}22` : 'rgba(255,255,255,0.1)') : 'rgba(255,255,255,0.04)',
                        color: active ? (cfg ? cfg.color : 'white') : 'rgba(113,113,122,0.5)',
                      }}
                    >
                      {tierCounts[t] ?? 0}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Result count */}
            <span className="ml-auto text-[9px] font-bold tracking-[0.14em] uppercase text-zinc-700">
              {loading ? '…' : `${displayed.length} of ${memories.length} nodes`}
            </span>
          </div>
        </div>

        {/* ── Memory table ─────────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Column headers */}
          {!loading && displayed.length > 0 && (
            <div
              className="grid items-center px-5 py-2.5 gap-4"
              style={{ gridTemplateColumns: '1.8fr 1.2fr 1fr 1fr 1fr 1.2fr 44px 44px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            >
              {['ENTITY KEY', 'SESSION', 'AGENT', 'TIER', 'TTL LEFT', 'CREATED', '', ''].map((h, i) => (
                <p key={i} className="text-[9px] font-bold tracking-[0.18em] uppercase text-zinc-600">{h}</p>
              ))}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div>
              <div className="px-5 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="grid gap-4" style={{ gridTemplateColumns: '1.8fr 1.2fr 1fr 1fr 1fr 1.2fr 44px 44px' }}>
                  {['ENTITY KEY', 'SESSION', 'AGENT', 'TIER', 'TTL LEFT', 'CREATED', '', ''].map((h, i) => (
                    <p key={i} className="text-[9px] font-bold tracking-[0.18em] uppercase text-zinc-600">{h}</p>
                  ))}
                </div>
              </div>
              {[...Array(7)].map((_, i) => <RowSkeleton key={i} />)}
            </div>
          )}

          {/* Empty state */}
          {!loading && displayed.length === 0 && (
            <div className="px-6 py-20 flex flex-col items-center justify-center gap-3">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-zinc-700" aria-hidden="true">
                <path d="M20 4C11.16 4 4 11.16 4 20s7.16 16 16 16 16-7.16 16-16S28.84 4 20 4Z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M4 20h32M20 4c-4 4.57-6.86 9.97-6.86 16S16 35.43 20 40M20 4c4 4.57 6.86 9.97 6.86 16S24 35.43 20 40" stroke="currentColor" strokeWidth="1.3"/>
              </svg>
              {memories.length > 0 ? (
                <>
                  <p className="text-[13px] font-bold text-zinc-500">No nodes match your filters</p>
                  <button
                    onClick={clearAll}
                    className="text-[11px] font-bold tracking-[0.1em] uppercase text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Clear all filters
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[14px] font-bold text-zinc-500">Memory mesh is empty</p>
                  <p className="text-[11px] text-zinc-700 text-center max-w-xs">
                    Memories appear here once your agent writes them via the HoloMem SDK.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Rows */}
          {!loading && displayed.map((m) => {
            const ttl = ttlRemaining(m.expires_at);
            const tier = TIER[m.ttl_tier as keyof typeof TIER] ?? TIER_FALLBACK;

            return (
              <div
                key={m.entity_key}
                className="grid items-center px-5 py-3 gap-4 group transition-colors hover:bg-white/[0.02]"
                style={{ gridTemplateColumns: '1.8fr 1.2fr 1fr 1fr 1fr 1.2fr 44px 44px', borderBottom: '1px solid rgba(255,255,255,0.035)' }}
              >
                {/* Entity key */}
                <div className="flex items-center gap-2 min-w-0">
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="text-zinc-700 shrink-0" aria-hidden="true">
                    <circle cx="4" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.1"/>
                    <path d="M6 5.5h4.5M9 4.5V5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                  </svg>
                  <span className="font-mono text-[11px] text-zinc-300 truncate tracking-wide">{shortKey(m.entity_key)}</span>
                </div>

                {/* Session */}
                <Link
                  href={`/sessions/${encodeURIComponent(m.session_id)}`}
                  className="font-mono text-[11px] text-violet-400 hover:text-violet-300 transition-colors truncate block"
                  title={m.session_id}
                >
                  {shortSession(m.session_id)}
                </Link>

                {/* Agent */}
                <span className="text-[11px] text-zinc-500 truncate">
                  {m.agent_id ?? <span className="text-zinc-700">—</span>}
                </span>

                {/* Tier badge */}
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-[0.1em] w-fit"
                  style={{ background: tier.bg, border: `1px solid ${tier.border}`, color: tier.color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tier.dot }} />
                  {tier.label}
                </span>

                {/* TTL */}
                <div className="flex flex-col gap-1">
                  <span
                    className="text-[11px] font-bold tabular-nums"
                    style={{ color: ttl.expired ? '#52525b' : ttl.urgent ? '#f87171' : '#a1a1aa' }}
                  >
                    {ttl.label}
                  </span>
                  <div className="h-0.5 w-10 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${ttl.pct}%`,
                        background: ttl.expired ? '#3f3f46' : ttl.urgent ? '#f87171' : '#34d399',
                      }}
                    />
                  </div>
                </div>

                {/* Created */}
                <span className="text-[10px] text-zinc-600 font-mono">{formatDate(m.created_at)}</span>

                {/* Pin */}
                <button
                  onClick={() => togglePin(m.entity_key, m.pinned)}
                  disabled={pinning === m.entity_key}
                  className={`justify-self-end transition-all w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-violet-500 ${m.pinned ? 'text-violet-400 opacity-100' : 'opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-violet-400 hover:bg-violet-500/10'}`}
                  aria-label={m.pinned ? `Unpin memory ${m.entity_key}` : `Pin memory ${m.entity_key}`}
                  title={m.pinned ? 'Pinned — click to unpin' : 'Pin to prevent TTL expiry'}
                >
                  {pinning === m.entity_key ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="animate-spin" aria-hidden="true">
                      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="14 7"/>
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M7 1L11 5L9 7L7 5L4 8L2 9L3 7L6 4L4 2L7 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill={m.pinned ? 'currentColor' : 'none'}/>
                      <path d="M2 10L4 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  )}
                </button>

                {/* Delete */}
                <button
                  onClick={() => deleteMemory(m.entity_key)}
                  disabled={deleting === m.entity_key}
                  className="justify-self-end opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-red-500"
                  aria-label={`Delete memory ${m.entity_key}`}
                >
                  {deleting === m.entity_key ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="animate-spin" aria-hidden="true">
                      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="14 7"/>
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2 3h8M4.5 3V2h3v1M5 5.5v3M7 5.5v3M3 3l.5 7h5l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
