'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardShell from '../../../components/DashboardShell';
import { apiGet, apiDelete, AuthError, type MemoryEntry } from '../../../lib/api';
import { useRequireAuth } from '../../../lib/auth';
import { useToast } from '../../../components/Toast';

/* ─── Helpers ──────────────────────────────────────────────────────────── */
function ttlRemaining(expiresAt: string): { label: string; pct: number; urgent: boolean } {
  const totalLife = 24 * 60 * 60 * 1000; // assume 24h baseline for bar width
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { label: 'Expired', pct: 0, urgent: true };
  const s = Math.floor(ms / 1000);
  const pct = Math.min(100, (ms / totalLife) * 100);
  const urgent = ms < 60 * 60 * 1000; // < 1 hour
  if (s < 60) return { label: `${s}s`, pct, urgent };
  const m = Math.floor(s / 60);
  if (m < 60) return { label: `${m}m`, pct, urgent };
  const h = Math.floor(m / 60);
  if (h < 24) return { label: `${h}h`, pct, urgent };
  return { label: `${Math.floor(h / 24)}d`, pct, urgent: false };
}

function shortKey(key: string): string {
  return key.length > 24 ? `${key.slice(0, 12)}…${key.slice(-8)}` : key;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

/* ─── TTL tier config ──────────────────────────────────────────────────── */
const TIER_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  working:    { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.25)',  label: 'WORKING'    },
  episodic:   { color: '#38bdf8', bg: 'rgba(56,189,248,0.1)',   border: 'rgba(56,189,248,0.25)',  label: 'EPISODIC'   },
  persistent: { color: '#34d399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.25)',  label: 'PERSISTENT' },
};
const DEFAULT_TIER = { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)', label: 'UNKNOWN' };

/* ─── Skeleton ─────────────────────────────────────────────────────────── */
function TableRowSkeleton() {
  return (
    <div className="grid items-center px-5 py-3.5 gap-4 animate-pulse" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr 48px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      {[100, 60, 80, 50, 90].map((w, i) => (
        <div key={i} className="h-3 rounded" style={{ width: `${w}%`, background: 'rgba(255,255,255,0.05)' }} />
      ))}
      <div className="h-5 w-10 rounded bg-white/[0.03] justify-self-end" />
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */
export default function SessionDetailPage() {
  useRequireAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { toast, confirm } = useToast();
  const sessionId = decodeURIComponent(id);

  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingSession, setDeletingSession] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ memories: MemoryEntry[] }>(
        `/v1/memories?session_id=${encodeURIComponent(sessionId)}`
      );
      setMemories(data.memories);
    } catch (e) {
      if (e instanceof AuthError) router.replace('/login');
    } finally {
      setLoading(false);
    }
  }, [sessionId, router]);

  useEffect(() => { load(); }, [load]);

  async function deleteSession() {
    const ok = await confirm({
      title: 'Delete entire session?',
      body: `This will soft-delete all ${memories.length} memory node${memories.length !== 1 ? 's' : ''} in "${sessionId}". On-chain data expires via TTL.`,
      confirm: 'Delete session',
      danger: true,
    });
    if (!ok) return;
    setDeletingSession(true);
    try {
      await apiDelete(`/v1/sessions/${encodeURIComponent(sessionId)}`);
      toast(`Session deleted — ${memories.length} node${memories.length !== 1 ? 's' : ''} removed`, 'success');
      router.replace('/sessions');
    } catch {
      toast('Failed to delete session', 'error');
      setDeletingSession(false);
    }
  }

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
      toast('Failed to delete memory', 'error');
    } finally {
      setDeleting(null);
    }
  }

  const agents = [...new Set(memories.map((m) => m.agent_id).filter(Boolean))];
  const tiers = memories.reduce<Record<string, number>>((acc, m) => {
    acc[m.ttl_tier] = (acc[m.ttl_tier] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <DashboardShell>
      <div className="p-6 space-y-5">

        {/* ── Breadcrumb ──────────────────────────────────────────── */}
        <div className="flex items-center gap-2 text-[11px] font-semibold">
          <Link
            href="/sessions"
            className="text-zinc-600 hover:text-violet-400 transition-colors flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M8 2 4 6l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Agent Nodes
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="font-mono text-zinc-400 truncate max-w-[300px]">{sessionId}</span>
        </div>

        {/* ── Page header ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-white tracking-tight">Session Detail</h1>
            <p className="text-[11px] font-mono text-zinc-600 mt-1 tracking-wide">{sessionId}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold tracking-[0.1em] uppercase text-zinc-400 hover:text-zinc-200 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              aria-label="Refresh"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M10 6A4 4 0 1 1 6 2M6 2l2-2M6 2l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Refresh
            </button>
            {!loading && memories.length > 0 && (
              <button
                onClick={deleteSession}
                disabled={deletingSession}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold tracking-[0.1em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-40"
                style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}
                aria-label="Delete session"
              >
                {deletingSession ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="animate-spin" aria-hidden="true">
                    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="14 7"/>
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 3h8M4.5 3V2h3v1M5 5.5v3M7 5.5v3M3 3l.5 7h5l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                Delete Session
              </button>
            )}
          </div>
        </div>

        {/* ── Stat mini-cards ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            {
              label: 'Memory Nodes',
              value: loading ? '—' : memories.length.toString(),
              sub: loading ? '' : `active in session`,
              color: '#a78bfa',
              icon: (
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <path d="M7.5 1C4.46 1 2 3.46 2 6.5S4.46 12 7.5 12 13 9.54 13 6.5 10.54 1 7.5 1Z" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M2 6.5h11M7.5 1C6.17 2.8 5.3 4.6 5.3 6.5s.87 3.7 2.2 5.5M7.5 1C8.83 2.8 9.7 4.6 9.7 6.5s-.87 3.7-2.2 5.5" stroke="currentColor" strokeWidth="1.1"/>
                </svg>
              ),
            },
            {
              label: 'Unique Agents',
              value: loading ? '—' : agents.length.toString(),
              sub: loading ? '' : agents.length > 0 ? agents.slice(0, 2).join(', ') : 'No agents tagged',
              color: '#38bdf8',
              icon: (
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M2 13.5c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              ),
            },
            {
              label: 'Working',
              value: loading ? '—' : (tiers['working'] ?? 0).toString(),
              sub: 'short-lived nodes',
              color: '#fbbf24',
              icon: (
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M7.5 4.5v3l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              ),
            },
            {
              label: 'Persistent',
              value: loading ? '—' : (tiers['persistent'] ?? 0).toString(),
              sub: 'long-term memory',
              color: '#34d399',
              icon: (
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <path d="M2 7.5C2 4.46 4.46 2 7.5 2s5.5 2.46 5.5 5.5-2.46 5.5-5.5 5.5S2 10.54 2 7.5Z" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M5 7.5l2 2 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ),
            },
          ].map((card) => (
            <div
              key={card.label}
              className="p-4 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-zinc-600">{card.label}</p>
                <span style={{ color: card.color }}>{card.icon}</span>
              </div>
              <p className="text-[1.6rem] font-bold text-white leading-none mb-1" style={{ color: card.value !== '0' && card.value !== '—' ? 'white' : 'rgba(255,255,255,0.4)' }}>
                {card.value}
              </p>
              <p className="text-[10px] text-zinc-600 truncate">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Memory table ─────────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Table header bar */}
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <h2 className="text-[14px] font-bold text-white">Memory Nodes</h2>
              <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-zinc-600 mt-0.5">On-Chain Encrypted Entries</p>
            </div>
            {!loading && memories.length > 0 && (
              <div className="flex items-center gap-2">
                {Object.entries(tiers).map(([tier, count]) => {
                  const cfg = TIER_CONFIG[tier] ?? DEFAULT_TIER;
                  return (
                    <span
                      key={tier}
                      className="px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-[0.12em]"
                      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
                    >
                      {count} {cfg.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Column headers */}
          {!loading && memories.length > 0 && (
            <div
              className="grid items-center px-5 py-2.5 gap-4"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr 48px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            >
              {['ENTITY KEY', 'AGENT', 'TIER', 'TTL LEFT', 'CREATED', ''].map((h) => (
                <p key={h} className="text-[9px] font-bold tracking-[0.18em] uppercase text-zinc-600">{h}</p>
              ))}
            </div>
          )}

          {/* Rows */}
          {loading ? (
            <div>
              {[...Array(5)].map((_, i) => <TableRowSkeleton key={i} />)}
            </div>
          ) : memories.length === 0 ? (
            <div className="px-6 py-16 flex flex-col items-center justify-center gap-3">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="text-zinc-700" aria-hidden="true">
                <path d="M18 4C10.27 4 4 10.27 4 18s6.27 14 14 14 14-6.27 14-14S25.73 4 18 4Z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M4 18h28M18 4c-3.5 4-6 8.73-6 14s2.5 10 6 14M18 4c3.5 4 6 8.73 6 14s-2.5 10-6 14" stroke="currentColor" strokeWidth="1.3"/>
              </svg>
              <p className="text-[13px] font-bold text-zinc-500">No memory nodes found</p>
              <p className="text-[11px] text-zinc-700 text-center max-w-xs">
                Memories may have expired or been deleted from this session.
              </p>
            </div>
          ) : (
            memories.map((m) => {
              const ttl = ttlRemaining(m.expires_at);
              const tier = TIER_CONFIG[m.ttl_tier] ?? DEFAULT_TIER;
              return (
                <div
                  key={m.entity_key}
                  className="grid items-center px-5 py-3.5 gap-4 group transition-colors hover:bg-white/[0.02]"
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr 48px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  {/* Entity key */}
                  <div className="flex items-center gap-2 min-w-0">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-zinc-700 shrink-0" aria-hidden="true">
                      <circle cx="4.5" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M6.5 6h5M9.5 5V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    <span className="font-mono text-[11px] text-zinc-300 truncate">{shortKey(m.entity_key)}</span>
                  </div>

                  {/* Agent */}
                  <span className="text-[11px] text-zinc-500 truncate">{m.agent_id ?? <span className="text-zinc-700">—</span>}</span>

                  {/* Tier badge */}
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold tracking-[0.1em] w-fit"
                    style={{ background: tier.bg, border: `1px solid ${tier.border}`, color: tier.color }}
                  >
                    {tier.label}
                  </span>

                  {/* TTL */}
                  <div className="flex flex-col gap-1">
                    <span
                      className="text-[11px] font-bold tabular-nums"
                      style={{ color: ttl.urgent ? '#f87171' : ttl.pct === 0 ? '#52525b' : '#a1a1aa' }}
                    >
                      {ttl.label}
                    </span>
                    <div className="h-0.5 rounded-full overflow-hidden w-12" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${ttl.pct}%`,
                          background: ttl.urgent ? '#f87171' : ttl.pct === 0 ? '#52525b' : '#34d399',
                        }}
                      />
                    </div>
                  </div>

                  {/* Created */}
                  <span className="text-[10px] text-zinc-600 font-mono">{formatDate(m.created_at)}</span>

                  {/* Delete */}
                  <button
                    onClick={() => deleteMemory(m.entity_key)}
                    disabled={deleting === m.entity_key}
                    className="justify-self-end opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition-colors focus-visible:ring-2 focus-visible:ring-red-500"
                    style={{ border: '1px solid transparent' }}
                    aria-label={`Delete memory ${m.entity_key}`}
                  >
                    {deleting === m.entity_key ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="animate-spin" aria-hidden="true">
                        <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="14 7"/>
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M2 3h8M4.5 3V2h3v1M5 5.5v3M7 5.5v3M3 3l.5 7h5l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
