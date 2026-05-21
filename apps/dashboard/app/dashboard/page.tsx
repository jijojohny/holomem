'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '../../components/Nav';
import { apiGet, AuthError, type Usage } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';

const TIER_LIMITS: Record<string, number | null> = { free: 1000, pro: 50000, team: 500000, enterprise: null };

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-violet-500';
  return (
    <div>
      <div className="flex justify-between text-xs text-zinc-400 mb-2">
        <span>{used.toLocaleString()} writes used</span>
        <span>{limit ? `${limit.toLocaleString()} limit` : 'Unlimited'}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  useRequireAuth();
  const router = useRouter();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<Usage>('/v1/usage')
      .then(setUsage)
      .catch((e) => {
        if (e instanceof AuthError) router.replace('/login');
        else setError('Failed to load usage');
      });
  }, [router]);

  const resetsAt = usage
    ? new Date(usage.writes.resets_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-2xl mx-auto px-6 py-10 space-y-4">
        <h1 className="text-xl font-semibold">Overview</h1>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!usage && !error && (
          <div className="glass-card p-6 animate-pulse h-40" />
        )}

        {usage && (
          <>
            <div className="glass-card p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="capitalize text-white font-medium">{usage.tier}</span>
                  <span className="text-zinc-500 text-sm ml-2">plan</span>
                </div>
                {usage.tier === 'free' && (
                  <button
                    onClick={() => router.push('/billing')}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    Upgrade →
                  </button>
                )}
              </div>
              <UsageBar used={usage.writes.used} limit={TIER_LIMITS[usage.tier] ?? null} />
              <p className="text-xs text-zinc-500">
                Resets {resetsAt} · {usage.reads.this_month.toLocaleString()} reads this month
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card p-5">
                <p className="text-2xl font-bold">{usage.memories.active}</p>
                <p className="text-zinc-400 text-sm mt-1">Active memories</p>
              </div>
              <button
                onClick={() => router.push('/sessions')}
                className="glass-card p-5 text-left hover:bg-white/8 hover:border-white/15 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                <p className="text-zinc-400 text-sm">Sessions</p>
                <p className="text-zinc-300 text-sm mt-1">View →</p>
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
