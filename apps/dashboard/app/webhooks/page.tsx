'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '../../components/DashboardShell';
import { apiGet, apiPost, apiDelete, AuthError, type Webhook, type WebhookDelivery } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';
import { useToast } from '../../components/Toast';

const ALL_EVENTS = ['write', 'read', 'delete', 'recall'] as const;
type EventName = typeof ALL_EVENTS[number];

const EVENT_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  write:  { color: '#2dd4bf', bg: 'rgba(45,212,191,0.1)',  border: 'rgba(45,212,191,0.25)',  label: 'WRITE'  },
  read:   { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)', label: 'READ'   },
  delete: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', label: 'DELETE' },
  recall: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)',  label: 'RECALL' },
  test:   { color: '#71717a', bg: 'rgba(113,113,122,0.1)', border: 'rgba(113,113,122,0.25)', label: 'TEST'   },
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/* ─── Stat card ────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, subColor, icon }: {
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

/* ─── Delivery row ─────────────────────────────────────────────────── */
function DeliveryStatusIcon({ code }: { code: number | null }) {
  if (code !== null && code >= 200 && code < 300) {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <circle cx="5" cy="5" r="4.5" stroke="#34d399" strokeWidth="1" />
        <path d="M2.5 5l2 2 3-3" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (code !== null) {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <circle cx="5" cy="5" r="4.5" stroke="#fbbf24" strokeWidth="1" />
        <path d="M5 3v2.5M5 7h.01" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <circle cx="5" cy="5" r="4.5" stroke="#f87171" strokeWidth="1" />
      <path d="M3 3l4 4M7 3 3 7" stroke="#f87171" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function DeliveriesPanel({ webhookId }: { webhookId: string }) {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ deliveries: WebhookDelivery[] }>(`/v1/webhooks/${webhookId}/deliveries`)
      .then((d) => setDeliveries(d.deliveries))
      .finally(() => setLoading(false));
  }, [webhookId]);

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
      {/* Sub-header */}
      <div className="grid px-5 py-2" style={{ gridTemplateColumns: '1fr 1fr 80px 1fr', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {['Event', 'Status', 'Code', 'Time'].map((h) => (
          <p key={h} className="text-[9px] font-bold tracking-[0.18em] uppercase text-zinc-700">{h}</p>
        ))}
      </div>

      {loading ? (
        <div className="px-5 py-3 text-[11px] text-zinc-600 animate-pulse">Loading delivery log…</div>
      ) : deliveries.length === 0 ? (
        <div className="px-5 py-3 text-[11px] text-zinc-600">No deliveries recorded yet.</div>
      ) : (
        deliveries.map((d) => {
          const style = EVENT_STYLE[d.event_type] ?? EVENT_STYLE.test;
          return (
            <div
              key={d.id}
              className="grid items-center px-5 py-2.5 hover:bg-white/[0.02] transition-colors"
              style={{ gridTemplateColumns: '1fr 1fr 80px 1fr', borderBottom: '1px solid rgba(255,255,255,0.03)' }}
            >
              <span
                className="inline-flex items-center w-fit px-2 py-0.5 rounded text-[9px] font-bold tracking-wide"
                style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
              >
                {style.label}
              </span>
              <div className="flex items-center gap-1.5">
                <DeliveryStatusIcon code={d.status_code} />
                <span className="text-[10px] font-bold" style={{ color: d.status_code !== null && d.status_code >= 200 && d.status_code < 300 ? '#34d399' : d.status_code !== null ? '#fbbf24' : '#f87171' }}>
                  {d.status_code !== null && d.status_code >= 200 && d.status_code < 300 ? 'Delivered' : d.status_code !== null ? 'Warn' : 'Failed'}
                </span>
              </div>
              <span className="font-mono text-[10px] text-zinc-500">{d.status_code ?? '—'}</span>
              <span className="text-[10px] text-zinc-600">{timeAgo(d.created_at)}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────── */
export default function WebhooksPage() {
  useRequireAuth();
  const router = useRouter();
  const { toast, confirm } = useToast();

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<Set<EventName>>(new Set(['write', 'delete']));
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ webhooks: Webhook[] }>('/v1/webhooks');
      setWebhooks(data.webhooks);
    } catch (e) {
      if (e instanceof AuthError) router.replace('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  function toggleEvent(ev: EventName) {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      next.has(ev) ? next.delete(ev) : next.add(ev);
      return next;
    });
  }

  async function createWebhook() {
    if (!url.trim() || selectedEvents.size === 0) return;
    setCreating(true);
    try {
      await apiPost('/v1/webhooks', { url: url.trim(), events: [...selectedEvents] });
      setUrl('');
      setSelectedEvents(new Set(['write', 'delete']));
      toast('Webhook registered', 'success');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create webhook', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function deleteWebhook(id: string) {
    const ok = await confirm({
      title: 'Delete this endpoint?',
      body: 'No further events will be delivered to this URL.',
      confirm: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiDelete(`/v1/webhooks/${id}`);
      setWebhooks((w) => w.filter((x) => x.id !== id));
      toast('Endpoint removed', 'success');
    } catch {
      toast('Failed to delete endpoint', 'error');
    }
  }

  async function testWebhook(id: string) {
    setTesting(id);
    try {
      const res = await apiPost<{ ok: boolean; status: number }>(`/v1/webhooks/${id}/test`);
      toast(
        res.ok ? `Test delivered — HTTP ${res.status}` : `Endpoint returned HTTP ${res.status}`,
        res.ok ? 'success' : 'error',
      );
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Test delivery failed', 'error');
    } finally {
      setTesting(null);
    }
  }

  const active = webhooks.filter((w) => w.active !== false);
  const successCount = webhooks.filter((w) => w.last_status !== null && w.last_status >= 200 && w.last_status < 300).length;
  const successRate = webhooks.length > 0 ? Math.round((successCount / webhooks.length) * 100) : 100;
  const lastDeliveryRaw = webhooks.reduce<string | null>((acc, w) => {
    if (!w.last_delivered_at) return acc;
    if (!acc || w.last_delivered_at > acc) return w.last_delivered_at;
    return acc;
  }, null);

  return (
    <DashboardShell>
      <div className="p-6 space-y-5">

        {/* ── Page header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-white tracking-tight">Security Logs</h1>
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-zinc-600 mt-0.5">
              Event Delivery &amp; Audit Endpoints
            </p>
          </div>
          <span
            className="text-[10px] font-bold tracking-[0.12em] uppercase px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#71717a' }}
          >
            {webhooks.length} / 10 Endpoints
          </span>
        </div>

        {/* ── Stat cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Total Endpoints"
            value={loading ? '—' : webhooks.length}
            sub="Registered"
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h9A1.5 1.5 0 0 1 14 4.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7Z" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M5 7.5h6M5 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            }
          />
          <StatCard
            label="Active Endpoints"
            value={loading ? '—' : active.length}
            sub={active.length > 0 ? 'Listening' : 'None active'}
            subColor="#34d399"
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="2" fill="currentColor" />
                <path d="M4.5 11.5a5 5 0 0 1 0-7M11.5 4.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M2.5 13.5a8 8 0 0 1 0-11M13.5 2.5a8 8 0 0 1 0 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            }
          />
          <StatCard
            label="Delivery Success"
            value={loading ? '—' : `${successRate}%`}
            sub={webhooks.length === 0 ? 'No deliveries yet' : `${successCount} of ${webhooks.length} healthy`}
            subColor={successRate >= 90 ? '#34d399' : successRate >= 70 ? '#fbbf24' : '#f87171'}
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 1.5 2 4v4.5c0 3 2.67 5.3 6 6 3.33-.7 6-3 6-6V4L8 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M5.5 8 7 9.5 10.5 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
          />
          <StatCard
            label="Last Delivery"
            value={loading ? '—' : lastDeliveryRaw ? timeAgo(lastDeliveryRaw) : 'Never'}
            sub="Most recent event"
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M8 5v3l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
          />
        </div>

        {/* ── Register endpoint form ───────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="text-[14px] font-bold text-white">Register Endpoint</h2>
            <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-zinc-600 mt-0.5">
              Configure event delivery target
            </p>
          </div>

          <div className="p-5 space-y-4">
            {/* URL input */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path d="M5.5 9.5a4 4 0 0 1 0-6M7.5 3.5a4 4 0 0 1 0 6M4 6.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createWebhook()}
                placeholder="https://your-server.com/webhook"
                className="w-full text-[12px] font-medium pl-9 pr-4 py-2.5 rounded-lg text-white placeholder-zinc-700 focus:outline-none transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(124,58,237,0.5)'; }}
                onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
              />
            </div>

            {/* Event toggles */}
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-zinc-600">Subscribe to events</p>
              <div className="flex flex-wrap gap-2">
                {ALL_EVENTS.map((ev) => {
                  const s = EVENT_STYLE[ev];
                  const on = selectedEvents.has(ev);
                  return (
                    <button
                      key={ev}
                      onClick={() => toggleEvent(ev)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-[0.1em] uppercase transition-all focus-visible:ring-2 focus-visible:ring-violet-500"
                      style={{
                        background: on ? s.bg : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${on ? s.border : 'rgba(255,255,255,0.07)'}`,
                        color: on ? s.color : '#52525b',
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full transition-colors"
                        style={{ background: on ? s.color : '#3f3f46' }}
                      />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={createWebhook}
              disabled={!url.trim() || selectedEvents.size === 0 || creating || webhooks.length >= 10}
              className="flex items-center justify-center gap-2 w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold tracking-[0.1em] uppercase py-2.5 rounded-lg transition-all hover:shadow-[0_0_20px_rgba(124,58,237,0.3)] focus-visible:ring-2 focus-visible:ring-violet-400"
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
              {creating ? 'Registering…' : 'Register Endpoint'}
            </button>
          </div>
        </div>

        {/* ── Endpoint list ────────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="text-[14px] font-bold text-white">Delivery Endpoints</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-zinc-500">Monitoring</span>
            </div>
          </div>

          {/* Column headers */}
          {!loading && webhooks.length > 0 && (
            <div
              className="grid px-5 py-2.5"
              style={{ gridTemplateColumns: '2.5fr 1.5fr 100px 1fr 140px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            >
              {['Endpoint URL', 'Events', 'Status', 'Last Delivery', ''].map((h) => (
                <p key={h} className="text-[9px] font-bold tracking-[0.18em] uppercase text-zinc-600">{h}</p>
              ))}
            </div>
          )}

          {/* States */}
          {loading ? (
            <div className="space-y-0">
              {[1, 2].map((i) => (
                <div key={i} className="px-5 py-4 flex gap-4 items-center animate-pulse" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="h-3 rounded bg-white/[0.06] flex-1" />
                  <div className="h-3 rounded bg-white/[0.06] w-24" />
                  <div className="h-3 rounded bg-white/[0.06] w-16" />
                  <div className="h-3 rounded bg-white/[0.06] w-20" />
                </div>
              ))}
            </div>
          ) : webhooks.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M4 10c0-3.31 2.69-6 6-6M16 10c0 3.31-2.69 6-6 6M10 7v3l2 2" stroke="rgba(167,139,250,0.7)" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="text-[13px] font-semibold text-zinc-400">No endpoints registered</p>
              <p className="text-[11px] text-zinc-600 mt-1">Register a webhook URL above to start receiving security events.</p>
            </div>
          ) : (
            webhooks.map((w, i) => {
              const isOk = w.last_status !== null && w.last_status >= 200 && w.last_status < 300;
              const isFailed = w.last_status === null && w.last_delivered_at !== null;
              const isExpanded = expanded === w.id;
              return (
                <div key={w.id}>
                  <div
                    className="grid items-center px-5 py-4 group transition-colors hover:bg-white/[0.02]"
                    style={{
                      gridTemplateColumns: '2.5fr 1.5fr 100px 1fr 140px',
                      borderBottom: i < webhooks.length - 1 || isExpanded ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}
                  >
                    {/* URL */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                          <path d="M2 5a3 3 0 1 0 6 0 3 3 0 0 0-6 0M8 5h1.5M1 4H2" stroke="rgba(167,139,250,0.7)" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <span className="font-mono text-[11px] text-zinc-300 truncate">{w.url}</span>
                    </div>

                    {/* Events */}
                    <div className="flex flex-wrap gap-1">
                      {w.events.map((ev) => {
                        const s = EVENT_STYLE[ev] ?? EVENT_STYLE.test;
                        return (
                          <span
                            key={ev}
                            className="text-[8px] font-bold tracking-wide px-1.5 py-0.5 rounded"
                            style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
                          >
                            {s.label}
                          </span>
                        );
                      })}
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-1.5">
                      {w.last_delivered_at === null ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                          <span className="text-[10px] font-bold text-zinc-600">Pending</span>
                        </>
                      ) : isOk ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span className="text-[10px] font-bold text-emerald-400">Healthy</span>
                        </>
                      ) : isFailed ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          <span className="text-[10px] font-bold text-red-400">Failed</span>
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                          <span className="text-[10px] font-bold text-yellow-400">HTTP {w.last_status}</span>
                        </>
                      )}
                    </div>

                    {/* Last delivery */}
                    <span className="text-[11px] font-mono text-zinc-500">
                      {w.last_delivered_at ? timeAgo(w.last_delivered_at) : '—'}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => testWebhook(w.id)}
                        disabled={testing === w.id}
                        className="text-[10px] font-bold tracking-[0.08em] uppercase text-zinc-400 hover:text-white disabled:opacity-40 transition-colors px-2.5 py-1 rounded-md focus-visible:ring-2 focus-visible:ring-violet-500"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        {testing === w.id ? (
                          <svg className="animate-spin inline" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="11 6" strokeLinecap="round"/>
                          </svg>
                        ) : 'Test'}
                      </button>
                      <button
                        onClick={() => setExpanded(isExpanded ? null : w.id)}
                        className="text-[10px] font-bold tracking-[0.08em] uppercase transition-colors px-2.5 py-1 rounded-md focus-visible:ring-2 focus-visible:ring-violet-500"
                        style={{
                          background: isExpanded ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${isExpanded ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.08)'}`,
                          color: isExpanded ? '#a78bfa' : 'rgba(161,161,170,0.8)',
                        }}
                      >
                        Logs
                      </button>
                      <button
                        onClick={() => deleteWebhook(w.id)}
                        className="opacity-0 group-hover:opacity-100 text-[10px] font-bold tracking-[0.08em] uppercase text-red-400 hover:text-red-300 transition-all px-2.5 py-1 rounded-md focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:opacity-100"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Expanded delivery logs */}
                  {isExpanded && <DeliveriesPanel webhookId={w.id} />}
                </div>
              );
            })
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
            Webhooks deliver real-time event notifications to your infrastructure. Validate the <span className="text-zinc-500 font-mono">x-holomem-signature</span> header on each delivery to verify authenticity. Endpoints must respond with HTTP 2xx within 10 seconds.
          </p>
        </div>

      </div>
    </DashboardShell>
  );
}
