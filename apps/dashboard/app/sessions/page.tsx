'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '../../components/DashboardShell';
import { apiGet, AuthError, type Session } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function isActive(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 5 * 60 * 1000;
}

function shortId(id: string): string {
  if (id.length <= 16) return id.toUpperCase();
  return `${id.slice(0, 8)}…${id.slice(-6)}`.toUpperCase();
}

/* ─── Stat card ──────────────────────────────────────────────────────── */
function StatCard({
  label, value, sub, subColor, icon,
}: {
  label: string; value: string; sub?: string; subColor?: string; icon: React.ReactNode;
}) {
  return (
    <div
      className="relative p-5 rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-zinc-500">{label}</p>
        <span className="text-zinc-600">{icon}</span>
      </div>
      <p className="text-[2rem] font-bold text-white leading-none tracking-tight mb-1.5">{value}</p>
      {sub && (
        <p className="text-[11px] font-semibold" style={{ color: subColor ?? 'rgba(161,161,170,0.7)' }}>{sub}</p>
      )}
    </div>
  );
}

/* ─── Node card ───────────────────────────────────────────────────────── */
const NODE_COLORS = ['#a78bfa', '#34d399', '#7c3aed', '#2dd4bf', '#6366f1', '#fbbf24', '#f87171', '#38bdf8'];

function NodeCard({ session, index, onClick }: { session: Session; index: number; onClick: () => void }) {
  const active = isActive(session.last_activity);
  const color = NODE_COLORS[index % NODE_COLORS.length];
  const memBar = Math.min(100, (session.memory_count / 20) * 100);

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-5 transition-all group focus-visible:ring-2 focus-visible:ring-violet-500"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.055)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          {/* Node icon with color */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black"
            style={{ background: `${color}18`, border: `1px solid ${color}30`, color }}
          >
            {String(index + 1).padStart(2, '0')}
          </div>
          <div>
            <p className="text-[11px] font-black tracking-[0.1em] text-white font-mono">{shortId(session.session_id)}</p>
            <p className="text-[9px] text-zinc-600 tracking-[0.1em] mt-0.5">SESSION NODE</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* On-chain badge */}
          {session.session_entity_key && (
            <div
              className="px-1.5 py-1 rounded-md text-[9px] font-bold tracking-[0.1em]"
              style={{
                background: 'rgba(167,139,250,0.1)',
                border: '1px solid rgba(167,139,250,0.25)',
                color: '#a78bfa',
              }}
              title={`Arkiv entity: ${session.session_entity_key}`}
            >
              ⬡
            </div>
          )}
          {/* Status badge */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-bold tracking-[0.12em]"
            style={{
              background: active ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)',
              border: active ? '1px solid rgba(52,211,153,0.25)' : '1px solid rgba(255,255,255,0.08)',
              color: active ? '#34d399' : '#52525b',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background: active ? '#34d399' : '#52525b',
                boxShadow: active ? '0 0 6px rgba(52,211,153,0.7)' : 'none',
              }}
            />
            {active ? 'ACTIVE' : 'IDLE'}
          </div>
        </div>
      </div>

      {/* Memory count + bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-zinc-600">Memory Nodes</span>
          <span className="text-[13px] font-bold text-white tabular-nums">{session.memory_count}</span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${memBar}%`, background: color, opacity: 0.7 }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <circle cx="5.5" cy="5.5" r="4.5" stroke="rgba(113,113,122,0.6)" strokeWidth="1"/>
            <path d="M5.5 3v2.5l1.5 1.5" stroke="rgba(113,113,122,0.6)" strokeWidth="1" strokeLinecap="round"/>
          </svg>
          <span className="text-[10px] text-zinc-600 font-mono">{timeAgo(session.last_activity)}</span>
        </div>
        <span
          className="text-[9px] font-bold tracking-[0.1em] uppercase transition-colors group-hover:text-violet-400"
          style={{ color: 'rgba(113,113,122,0.5)' }}
        >
          Inspect →
        </span>
      </div>
    </button>
  );
}

/* ─── Skeleton ────────────────────────────────────────────────────────── */
function NodeSkeleton() {
  return (
    <div className="rounded-xl p-5 animate-pulse" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/5" />
          <div className="space-y-1.5">
            <div className="h-2.5 w-28 rounded bg-white/5" />
            <div className="h-2 w-16 rounded bg-white/[0.03]" />
          </div>
        </div>
        <div className="h-5 w-14 rounded-md bg-white/5" />
      </div>
      <div className="mb-4 space-y-1.5">
        <div className="flex justify-between">
          <div className="h-2 w-20 rounded bg-white/[0.03]" />
          <div className="h-3 w-6 rounded bg-white/5" />
        </div>
        <div className="h-1 w-full rounded-full bg-white/5" />
      </div>
      <div className="flex justify-between">
        <div className="h-2.5 w-16 rounded bg-white/[0.03]" />
        <div className="h-2.5 w-12 rounded bg-white/[0.03]" />
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────── */
type StatusFilter = 'all' | 'active' | 'idle';
type OnChainFilter = 'all' | 'onchain';

export default function SessionsPage() {
  useRequireAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'activity' | 'memories'>('activity');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [onChainFilter, setOnChainFilter] = useState<OnChainFilter>('all');

  useEffect(() => {
    apiGet<{ sessions: Session[] }>('/v1/sessions')
      .then((d) => setSessions(d.sessions))
      .catch((e) => { if (e instanceof AuthError) router.replace('/login'); })
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = useMemo(() => {
    let s = sessions;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      s = s.filter((x) => x.session_id.toLowerCase().includes(q));
    }
    if (statusFilter === 'active') s = s.filter((x) => isActive(x.last_activity));
    if (statusFilter === 'idle') s = s.filter((x) => !isActive(x.last_activity));
    if (onChainFilter === 'onchain') s = s.filter((x) => x.session_entity_key !== null);
    if (sort === 'memories') return [...s].sort((a, b) => b.memory_count - a.memory_count);
    return [...s].sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime());
  }, [sessions, search, sort, statusFilter, onChainFilter]);

  const activeCount = sessions.filter((s) => isActive(s.last_activity)).length;
  const totalMemories = sessions.reduce((acc, s) => acc + s.memory_count, 0);
  const avgMem = sessions.length > 0 ? (totalMemories / sessions.length).toFixed(1) : '0';

  return (
    <DashboardShell>
      <div className="p-6 space-y-5">

        {/* ── Page header ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-white tracking-tight">Agent Nodes</h1>
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-zinc-600 mt-0.5">
              Sovereign Session Registry
            </p>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-bold tracking-[0.14em] uppercase">
            <span className="text-zinc-600">Sort:</span>
            {(['activity', 'memories'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className="px-3 py-1.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-violet-500"
                style={{
                  background: sort === s ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                  border: sort === s ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  color: sort === s ? '#c4b5fd' : 'rgba(113,113,122,0.8)',
                }}
              >
                {s === 'activity' ? 'Latest' : 'Memories'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Stat cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Total Nodes"
            value={loading ? '—' : sessions.length.toString()}
            sub={loading ? '' : `${sessions.length} session${sessions.length !== 1 ? 's' : ''} registered`}
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
                <circle cx="2.5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.4"/>
                <circle cx="13.5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.4"/>
                <circle cx="2.5" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.4"/>
                <circle cx="13.5" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M4 4.5 6 6.5M10 6.5 12 4.5M4 11.5 6 9.5M10 9.5 12 11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            }
          />
          <StatCard
            label="Active Now"
            value={loading ? '—' : activeCount.toString()}
            sub={loading ? '' : activeCount > 0 ? 'Activity in last 5 min' : 'No recent activity'}
            subColor={activeCount > 0 ? '#34d399' : undefined}
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 8h2.5l2-5 2.5 10 2-5H15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
          />
          <StatCard
            label="Total Memories"
            value={loading ? '—' : totalMemories.toLocaleString()}
            sub={loading ? '' : `Across all active nodes`}
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 1.5C4.41 1.5 1.5 4.41 1.5 8S4.41 14.5 8 14.5 14.5 11.59 14.5 8 11.59 1.5 8 1.5Z" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M1.5 8h13M8 1.5C6.5 3.5 5.5 5.6 5.5 8s1 4.5 2.5 6.5M8 1.5C9.5 3.5 10.5 5.6 10.5 8s-1 4.5-2.5 6.5" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
            }
          />
          <StatCard
            label="Avg Per Node"
            value={loading ? '—' : avgMem}
            sub={loading ? '' : 'memory nodes per session'}
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 11 6 6l3 3 2-2.5 3 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 14h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            }
          />
        </div>

        {/* ── Search + filter bar ─────────────────────────────────── */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Search row */}
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-zinc-600 shrink-0" aria-hidden="true">
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
              <path d="m9 9 2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="FILTER BY SESSION ID..."
              className="flex-1 bg-transparent text-[11px] font-semibold tracking-[0.1em] text-zinc-300 placeholder-zinc-700 focus:outline-none"
              aria-label="Filter sessions by ID"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-zinc-600 hover:text-zinc-400 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
                aria-label="Clear search"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <path d="M2 2l9 9M11 2l-9 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </button>
            )}
            <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-zinc-600 ml-2 shrink-0">
              {loading ? '—' : `Showing ${filtered.length} of ${sessions.length}`}
            </span>
          </div>

          {/* Filter pills row */}
          <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
            <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-zinc-700 mr-1">Status:</span>
            {(['all', 'active', 'idle'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="px-2.5 py-1 rounded-full text-[9px] font-bold tracking-[0.12em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-violet-500"
                style={{
                  background: statusFilter === s ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                  border: statusFilter === s ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  color: statusFilter === s ? '#c4b5fd' : 'rgba(113,113,122,0.8)',
                }}
              >
                {s === 'all' ? 'All' : s === 'active' ? 'Active' : 'Idle'}
              </button>
            ))}
            <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-zinc-700 ml-3 mr-1">Chain:</span>
            {(['all', 'onchain'] as OnChainFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setOnChainFilter(s)}
                className="px-2.5 py-1 rounded-full text-[9px] font-bold tracking-[0.12em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-violet-500"
                style={{
                  background: onChainFilter === s ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                  border: onChainFilter === s ? '1px solid rgba(167,139,250,0.35)' : '1px solid rgba(255,255,255,0.08)',
                  color: onChainFilter === s ? '#a78bfa' : 'rgba(113,113,122,0.8)',
                }}
              >
                {s === 'all' ? 'All' : '⬡ On-chain only'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Node grid ───────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <NodeSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="rounded-xl px-6 py-16 flex flex-col items-center justify-center gap-3"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {search ? (
              <>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-zinc-700" aria-hidden="true">
                  <circle cx="14" cy="14" r="9" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="m21 21 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M10 14h8M14 10v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <p className="text-[13px] font-bold text-zinc-500">No nodes match "{search}"</p>
                <button
                  onClick={() => setSearch('')}
                  className="text-[11px] font-bold tracking-[0.1em] uppercase text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Clear filter
                </button>
              </>
            ) : (
              <>
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="text-zinc-700" aria-hidden="true">
                  <circle cx="18" cy="18" r="5" stroke="currentColor" strokeWidth="1.5"/>
                  <circle cx="6" cy="9" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  <circle cx="30" cy="9" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  <circle cx="6" cy="27" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  <circle cx="30" cy="27" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M9 10 13 14M23 14 27 10M9 26 13 22M23 22 27 26" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                <p className="text-[14px] font-bold text-zinc-500">No agent nodes deployed</p>
                <p className="text-[11px] text-zinc-700 text-center max-w-xs">
                  Write a memory using the HoloMem SDK to register your first agent node.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((s, i) => (
              <NodeCard
                key={s.session_id}
                session={s}
                index={sessions.indexOf(s)}
                onClick={() => router.push(`/sessions/${encodeURIComponent(s.session_id)}`)}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
