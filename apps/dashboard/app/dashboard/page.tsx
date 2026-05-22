'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardShell from '../../components/DashboardShell';
import { apiGet, AuthError, type Usage, type DayUsage, type ActivityEvent, type Session } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';

/* ─── Types ─────────────────────────────────────────────────────────── */
interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  icon: React.ReactNode;
  extra?: React.ReactNode;
}

const ACTION_MAP: Record<string, { label: string; color: string }> = {
  write:  { label: 'MEMORY_FORGE', color: '#2dd4bf' },
  read:   { label: 'MESH_QUERY',   color: '#a78bfa' },
  delete: { label: 'DATA_PURGE',   color: '#f87171' },
  recall: { label: 'DATA_SHARD',   color: '#34d399' },
};

const ENCRYPT_MAP: Record<string, { label: string; ok: boolean }> = {
  write:  { label: 'AES-256', ok: true },
  read:   { label: 'PKE_RSA', ok: true },
  delete: { label: 'AES-256', ok: true },
  recall: { label: 'TLS_1.3', ok: false },
};

/* ─── Circular progress ────────────────────────────────────────────── */
function CircleProgress({ pct, size = 60 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth="4" fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke="#34d399" strokeWidth="4" fill="none"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
    </svg>
  );
}

/* ─── Mini bar chart ───────────────────────────────────────────────── */
function MiniBar({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-7">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all"
          style={{
            height: `${(v / max) * 100}%`,
            minHeight: 2,
            background: i === values.length - 1 ? 'rgba(52,211,153,0.8)' : 'rgba(255,255,255,0.15)',
          }}
        />
      ))}
    </div>
  );
}

/* ─── Stat card ────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, subColor, icon, extra }: StatCardProps) {
  return (
    <div
      className="relative p-5 rounded-xl overflow-hidden group"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-zinc-500">{label}</p>
        <span className="text-zinc-600">{icon}</span>
      </div>
      <p className="text-[2rem] font-bold text-white leading-none tracking-tight mb-1.5">{value}</p>
      {sub && (
        <p className="text-[11px] font-semibold" style={{ color: subColor ?? 'rgba(161,161,170,0.8)' }}>{sub}</p>
      )}
      {extra && <div className="mt-3">{extra}</div>}
    </div>
  );
}

/* ─── Node Visualization ───────────────────────────────────────────── */
const NODE_COLORS = ['#a78bfa', '#34d399', '#7c3aed', '#2dd4bf', '#6366f1', '#fbbf24', '#f87171', '#38bdf8'];

// Distribute nodes on a circular ring around the globe center (SVG viewBox 0-100)
function sessionToNode(s: Session, i: number, total: number) {
  const angle = (i / Math.max(total, 1)) * 2 * Math.PI - Math.PI / 2;
  // Alternate between inner ring (r=20) and outer ring (r=30)
  const r = i % 2 === 0 ? 20 : 29;
  const x = 50 + r * Math.cos(angle);
  const y = 50 + r * Math.sin(angle);
  const ageSecs = (Date.now() - new Date(s.last_activity).getTime()) / 1000;
  const isRecent = ageSecs < 300; // active in last 5 min
  const label = s.session_id.length > 10
    ? `SES_${s.session_id.slice(-6).toUpperCase()}`
    : s.session_id.toUpperCase();
  const status = isRecent
    ? `ACTIVE · ${s.memory_count} MEM`
    : `${s.memory_count} MEM`;
  const size = Math.min(10, Math.max(5, 4 + Math.floor(s.memory_count / 2)));
  return { id: label, x, y, status, color: NODE_COLORS[i % NODE_COLORS.length], size, isRecent };
}

function buildEdges(count: number): [number, number][] {
  if (count < 2) return [];
  const edges: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    edges.push([i, (i + 1) % count]); // ring
    if (count > 3 && i % 2 === 0) edges.push([i, (i + 2) % count]); // skip-one chords
  }
  return edges;
}

function NodeVisualization({ sessions }: { sessions: Session[] }) {
  const nodes = sessions.slice(0, 8).map((s, i, arr) => sessionToNode(s, i, arr.length));
  const edges = buildEdges(nodes.length);
  const isEmpty = nodes.length === 0;

  return (
    <div className="relative w-full h-[260px] overflow-hidden rounded-xl" style={{ background: '#06060e' }}>
      {/* Globe glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-[380px] h-[380px] rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, rgba(109,40,217,0.6) 0%, rgba(79,20,180,0.3) 40%, transparent 70%)' }}
        />
      </div>

      {/* Globe grid lines */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.06]" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {[30, 40, 50, 60, 70].map((y) => (
          <ellipse key={y} cx="50" cy={y} rx={Math.sqrt(Math.max(0, 625 - (y - 50) ** 2))} ry="3"
            fill="none" stroke="rgba(139,92,246,1)" strokeWidth="0.5" />
        ))}
        {[30, 40, 50, 60, 70].map((x) => (
          <line key={x} x1={x} y1="25" x2={x} y2="75" stroke="rgba(139,92,246,1)" strokeWidth="0.3" strokeDasharray="1 2" />
        ))}
        <circle cx="50" cy="50" r="25" fill="none" stroke="rgba(139,92,246,1)" strokeWidth="0.4" />
        <circle cx="50" cy="50" r="32" fill="none" stroke="rgba(139,92,246,0.5)" strokeWidth="0.3" />
      </svg>

      {/* Edges between real session nodes */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" aria-hidden="true">
        {edges.map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a].x} y1={nodes[a].y}
            x2={nodes[b].x} y2={nodes[b].y}
            stroke="rgba(139,92,246,0.25)" strokeWidth="0.4" strokeDasharray="1.5 2"
          />
        ))}
      </svg>

      {/* Session nodes */}
      {nodes.map((n, i) => (
        <div
          key={n.id}
          className="absolute"
          style={{ left: `${n.x}%`, top: `${n.y}%`, transform: 'translate(-50%,-50%)' }}
        >
          {/* Pulse ring — brighter for recently active sessions */}
          <div
            className="absolute rounded-full animate-ping"
            style={{
              width: n.size * 4,
              height: n.size * 4,
              top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              background: n.color,
              opacity: n.isRecent ? 0.35 : 0.12,
              animationDuration: `${2 + (i % 4) * 0.5}s`,
            }}
          />
          {/* Dot */}
          <div
            className="relative rounded-full"
            style={{
              width: n.size, height: n.size,
              background: n.color,
              boxShadow: `0 0 ${n.size * 2}px ${n.color}${n.isRecent ? 'cc' : '60'}`,
            }}
          />
          {/* Tooltip */}
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-md text-[9px] font-bold whitespace-nowrap"
            style={{ background: 'rgba(10,10,20,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <p className="text-white tracking-wider">{n.id}</p>
            <p style={{ color: n.isRecent ? '#34d399' : '#71717a' }} className="tracking-wide">{n.status}</p>
          </div>
        </div>
      ))}

      {/* Empty state */}
      {isEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-zinc-600">No active sessions</p>
          <p className="text-[10px] text-zinc-700">Write a memory to see nodes appear here</p>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-5 flex flex-col gap-1.5">
        {[
          { color: '#a78bfa', label: 'MEMORY SESSIONS' },
          { color: '#34d399', label: 'ACTIVE (LAST 5 MIN)' },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: l.color }} />
            <span className="text-[9px] font-bold tracking-[0.14em] text-zinc-500">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Live session count */}
      {!isEmpty && (
        <div className="absolute top-3 right-4 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-zinc-500">
            {nodes.length} session{nodes.length !== 1 ? 's' : ''} live
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── Security Radar ───────────────────────────────────────────────── */
type RadarMetric = { label: string; value: number };

function buildRadarMetrics(
  usage: Usage,
  activity: ActivityEvent[],
  sessions: Session[],
): RadarMetric[] {
  const activeSessions = sessions.filter(
    (s) => Date.now() - new Date(s.last_activity).getTime() < 5 * 60 * 1000,
  ).length;

  // What fraction of write quota is still available (0–1)
  const writeCap = usage.writes.limit
    ? Math.max(0, 1 - usage.writes.used / usage.writes.limit)
    : 1.0;

  // Memory density: active memories relative to 20 = "full mesh" ceiling
  const memDensity = Math.min(1, usage.memories.active / Math.max(1, 20));

  // Recent operation coverage: how many of the last 8 activity slots are filled
  const recentOps = Math.min(1, activity.length / 8);

  // Session health: proportion of sessions that were active in the last 5 min
  const sessionAct =
    sessions.length > 0 ? Math.min(1, activeSessions / Math.max(1, sessions.length)) : 0;

  // Encryption coverage is a product invariant — always 1.0
  const encCoverage = 1.0;

  // Node redundancy: having ≥5 sessions = full redundancy
  const nodeRedund = Math.min(1, sessions.length / 5);

  return [
    { label: 'WRITE_CAP',   value: writeCap },
    { label: 'MEM_DENSITY', value: memDensity },
    { label: 'RECENT_OPS',  value: recentOps },
    { label: 'SESSION_ACT', value: sessionAct },
    { label: 'ENC_COVER',   value: encCoverage },
    { label: 'NODE_REDUND', value: nodeRedund },
  ];
}

function SecurityRadar({ metrics }: { metrics: RadarMetric[] }) {
  const cx = 90, cy = 90, R = 65;
  const n = metrics.length;

  function point(i: number, r: number): [number, number] {
    const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  const outerPts = metrics.map((_, i) => point(i, R));
  const valuePts = metrics.map((m, i) => point(i, R * m.value));
  const valueStr = valuePts.map((p) => p.join(',')).join(' ');

  return (
    <div className="relative">
      <svg width="180" height="180" viewBox="0 0 180 180" className="mx-auto">
        {/* Grid rings */}
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <polygon
            key={scale}
            points={outerPts.map(([x, y]) => `${cx + (x - cx) * scale},${cy + (y - cy) * scale}`).join(' ')}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="1"
          />
        ))}
        {/* Spokes */}
        {outerPts.map(([x, y], i) => (
          <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        ))}
        {/* Value fill */}
        <polygon
          points={valueStr}
          fill="rgba(124,58,237,0.18)"
          stroke="rgba(167,139,250,0.7)"
          strokeWidth="1.5"
        />
        {/* Value dots */}
        {valuePts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill="#a78bfa" />
        ))}
        {/* Labels */}
        {outerPts.map(([x, y], i) => {
          const dx = x - cx, dy = y - cy;
          const lx = cx + dx * 1.22;
          const ly = cy + dy * 1.22;
          return (
            <text
              key={i}
              x={lx} y={ly}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="6" fill="rgba(161,161,170,0.7)"
              fontFamily="inherit" fontWeight="700"
              letterSpacing="0.08em"
            >
              {metrics[i].label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  useRequireAuth();
  const router = useRouter();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [history, setHistory] = useState<DayUsage[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    Promise.all([
      apiGet<Usage>('/v1/usage'),
      apiGet<{ days: DayUsage[] }>('/v1/usage/history').then((d) => d.days).catch(() => [] as DayUsage[]),
      apiGet<{ events: ActivityEvent[] }>('/v1/activity?limit=8').then((d) => d.events).catch(() => [] as ActivityEvent[]),
      apiGet<{ sessions: Session[] }>('/v1/sessions').then((d) => d.sessions).catch(() => [] as Session[]),
    ])
      .then(([u, h, ev, s]) => {
        setUsage(u);
        setHistory(h);
        setActivity(ev);
        setSessions(s);
      })
      .catch((e) => {
        if (e instanceof AuthError) router.replace('/login');
      });
  }, [router]);

  const quotaPct = usage && usage.writes.limit
    ? Math.min(100, (usage.writes.used / usage.writes.limit) * 100)
    : 0;

  const writeValues = history.length > 0 ? history.map((d) => d.writes) : [0, 0, 0, 0, 0, 0, 0];
  const writesToday = history.length > 0 ? (history[history.length - 1]?.writes ?? 0) : 0;
  const totalOps = usage ? usage.writes.used + usage.reads.this_month : 0;

  const radarMetrics = usage ? buildRadarMetrics(usage, activity, sessions) : null;
  const integrityPct = radarMetrics
    ? Math.round((radarMetrics.reduce((sum, m) => sum + m.value, 0) / radarMetrics.length) * 100)
    : null;

  return (
    <DashboardShell>
      <div className="p-6 space-y-5">

        {/* ── Stat cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Active Agent Swarms"
            value={usage ? usage.memories.active.toLocaleString() : '—'}
            sub={usage ? (usage.memories.active === 0 ? 'No active nodes' : `${usage.memories.active} node${usage.memories.active !== 1 ? 's' : ''} live`) : '—'}
            subColor="#34d399"
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M2 13.5c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <circle cx="13" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <circle cx="3" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
            }
            extra={
              <div className="h-0.5 bg-white/[0.07] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${quotaPct}%` }} />
              </div>
            }
          />

          <StatCard
            label="Write Quota"
            value={usage ? usage.writes.used.toLocaleString() : '—'}
            sub={usage ? (usage.writes.limit ? `of ${usage.writes.limit.toLocaleString()} this month` : 'Unlimited') : '—'}
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <ellipse cx="8" cy="4" rx="5" ry="2" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M3 4v4c0 1.1 2.24 2 5 2s5-.9 5-2V4M3 8v4c0 1.1 2.24 2 5 2s5-.9 5-2V8" stroke="currentColor" strokeWidth="1.3"/>
              </svg>
            }
            extra={
              <div className="flex items-center gap-3">
                <CircleProgress pct={quotaPct} size={52} />
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Used</p>
                  <p className="text-[18px] font-bold text-white">{quotaPct.toFixed(0)}%</p>
                </div>
              </div>
            }
          />

          <StatCard
            label="Total Operations"
            value={usage ? totalOps.toLocaleString() : '—'}
            sub={usage ? `${usage.writes.used.toLocaleString()} writes · ${usage.reads.this_month.toLocaleString()} reads` : '—'}
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 12 6 5l3 4 2-3 3 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
            extra={<MiniBar values={writeValues} />}
          />

          <StatCard
            label="Writes Today"
            value={writesToday.toLocaleString()}
            sub={writesToday === 0 ? 'No writes yet today' : `+${writesToday} since midnight`}
            subColor={writesToday > 0 ? '#34d399' : undefined}
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 2v4M8 10v4M12 8h2M2 8h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3"/>
              </svg>
            }
          />
        </div>

        {/* ── Live Memory Mesh ─────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <h2 className="text-[15px] font-bold text-white">Live Memory Mesh</h2>
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-zinc-600 mt-0.5">Real-Time Agent Cluster Visualization</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                aria-label="Search nodes"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="m9 9 2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </button>
              <button
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                aria-label="Filter nodes"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <path d="M1 3h11M3 6.5h7M5 10h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </button>
              <Link
                href="/memories"
                className="text-[10px] font-bold tracking-[0.1em] uppercase text-white px-4 py-2 rounded-lg transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                Expand View
              </Link>
            </div>
          </div>
          <div className="p-4">
            <NodeVisualization sessions={sessions} />
          </div>
        </div>

        {/* ── Bottom row ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">

          {/* Recent Mesh Activity */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="text-[14px] font-bold text-white">Recent Mesh Activity</h2>
              <button className="text-zinc-600 hover:text-zinc-400 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 rounded" aria-label="Options">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="3" r="1" fill="currentColor"/><circle cx="8" cy="8" r="1" fill="currentColor"/><circle cx="8" cy="13" r="1" fill="currentColor"/>
                </svg>
              </button>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-4 gap-4 px-5 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {['AGENT ID', 'ACTION', 'TIMESTAMP', 'ENCRYPTION'].map((h) => (
                <p key={h} className="text-[9px] font-bold tracking-[0.18em] uppercase text-zinc-600">{h}</p>
              ))}
            </div>

            {/* Rows */}
            {activity.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-[12px] text-zinc-600">No mesh activity yet</p>
                <p className="text-[11px] text-zinc-700 mt-1">Write your first memory to see it here</p>
              </div>
            ) : (
              activity.slice(0, 6).map((ev, i) => {
                const action = ACTION_MAP[ev.event_type] ?? { label: ev.event_type.toUpperCase(), color: '#71717a' };
                const enc = ENCRYPT_MAP[ev.event_type] ?? { label: 'AES-256', ok: true };
                const ts = new Date(ev.created_at);
                const agentId = ev.session_id
                  ? `AG_${ev.session_id.slice(-4).toUpperCase()}_${String.fromCharCode(65 + (i % 26))}`
                  : `AG_${String(i + 1000).padStart(4, '0')}_X`;
                return (
                  <div key={i} className="grid grid-cols-4 gap-4 items-center px-5 py-3 transition-colors hover:bg-white/[0.02]"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <p className="text-[11px] font-bold text-zinc-300 font-mono">{agentId}</p>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold tracking-wide w-fit"
                      style={{ background: `${action.color}18`, color: action.color, border: `1px solid ${action.color}30` }}
                    >
                      {action.label}
                    </span>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      {ts.getHours().toString().padStart(2, '0')}:
                      {ts.getMinutes().toString().padStart(2, '0')}:
                      {ts.getSeconds().toString().padStart(2, '0')}.
                      {ts.getMilliseconds().toString().padStart(2, '0').slice(0, 2)}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {enc.ok ? (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                          <circle cx="5" cy="5" r="4.5" stroke="#34d399" strokeWidth="1"/>
                          <path d="M2.5 5l2 2 3-3" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                          <circle cx="5" cy="5" r="4.5" stroke="#71717a" strokeWidth="1"/>
                          <circle cx="5" cy="5" r="1.5" fill="#71717a"/>
                        </svg>
                      )}
                      <span className="text-[10px] font-bold" style={{ color: enc.ok ? '#34d399' : '#71717a' }}>
                        {enc.label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}

            {activity.length > 0 && (
              <div className="px-5 py-3">
                <Link
                  href="/sessions"
                  className="text-[10px] font-bold tracking-[0.14em] uppercase text-zinc-500 hover:text-violet-400 transition-colors"
                >
                  View Full Transaction History →
                </Link>
              </div>
            )}
          </div>

          {/* Security Health */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="text-[14px] font-bold text-white">Security Health</h2>
              <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-zinc-600 mt-0.5">System Defense Vectors</p>
            </div>

            <div className="p-4">
              {radarMetrics ? (
                <SecurityRadar metrics={radarMetrics} />
              ) : (
                <div className="h-[180px] flex items-center justify-center">
                  <svg className="animate-spin text-zinc-700" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28 14" strokeLinecap="round"/>
                  </svg>
                </div>
              )}

              {/* Overall integrity — computed from real metrics */}
              <div className="mt-4 px-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-zinc-400">Mesh Integrity Score</span>
                  <span
                    className="text-[13px] font-bold"
                    style={{ color: integrityPct === null ? '#52525b' : integrityPct >= 70 ? '#34d399' : integrityPct >= 40 ? '#fbbf24' : '#f87171' }}
                  >
                    {integrityPct === null ? '—' : `${integrityPct}%`}
                  </span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: integrityPct === null ? '0%' : `${integrityPct}%`,
                      background: integrityPct === null ? 'transparent' : integrityPct >= 70 ? '#10b981' : integrityPct >= 40 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
                <p className="text-[10px] text-zinc-600 mt-3 leading-relaxed">
                  {activity.length > 0
                    ? `${activity.length} event${activity.length !== 1 ? 's' : ''} recorded · All data encrypted at rest.`
                    : 'No events recorded yet. Write a memory to populate this view.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
