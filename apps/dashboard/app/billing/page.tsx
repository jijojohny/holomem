'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '../../components/Nav';
import { apiGet, apiPost, AuthError, type Usage } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    writes: '1,000 writes/mo',
    ttl: '7-day max TTL',
    features: ['TypeScript & Python SDK', 'Community support'],
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$49',
    writes: '50,000 writes/mo',
    ttl: '30-day TTL',
    features: ['Everything in Free', 'Priority support', 'Webhooks'],
    highlight: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: '$199',
    writes: '500,000 writes/mo',
    ttl: '30-day TTL',
    features: ['Everything in Pro', 'Team seats', 'Usage analytics API'],
    highlight: false,
  },
];

export default function BillingPage() {
  useRequireAuth();
  const router = useRouter();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState<string>('');

  useEffect(() => {
    apiGet<Usage>('/v1/usage')
      .then(setUsage)
      .catch((e) => { if (e instanceof AuthError) router.replace('/login'); });
  }, [router]);

  async function upgrade(tier: string) {
    setLoading(tier);
    try {
      const result = await apiPost<{ checkout_url: string }>('/v1/billing/checkout', { tier });
      window.location.href = result.checkout_url;
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Upgrade failed');
    } finally {
      setLoading('');
    }
  }

  async function openPortal() {
    setLoading('portal');
    try {
      const result = await apiPost<{ portal_url: string }>('/v1/billing/portal');
      window.location.href = result.portal_url;
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not open billing portal');
    } finally {
      setLoading('');
    }
  }

  const currentTier = usage?.tier ?? 'free';
  const isPaid = currentTier !== 'free';

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Billing</h1>
          {isPaid && (
            <button
              onClick={openPortal}
              disabled={loading === 'portal'}
              className="btn-ghost text-sm px-4 py-1.5 disabled:opacity-40"
            >
              {loading === 'portal' ? '…' : 'Manage subscription'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const isCurrent = currentTier === plan.id;
            const isUpgrade = plan.id !== 'free' && !isCurrent;
            return (
              <div
                key={plan.id}
                className={`backdrop-blur-md border rounded-2xl p-6 flex flex-col gap-4 ${
                  plan.highlight
                    ? 'bg-violet-600/10 border-violet-500/40 ring-1 ring-violet-500/20'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div>
                  {plan.highlight && (
                    <span className="text-xs font-medium text-violet-300 bg-violet-500/20 border border-violet-500/30 rounded-full px-3 py-0.5 inline-block mb-2">
                      Popular
                    </span>
                  )}
                  <p className="font-semibold text-white">{plan.name}</p>
                  <p className="text-2xl font-bold mt-1 text-white">
                    {plan.price}
                    <span className="text-zinc-400 text-sm font-normal">/mo</span>
                  </p>
                </div>
                <ul className="space-y-1.5 text-sm text-zinc-400 flex-1">
                  <li className="text-white text-sm font-medium">{plan.writes}</li>
                  <li>{plan.ttl}</li>
                  {plan.features.map((f) => <li key={f}>{f}</li>)}
                </ul>
                {isCurrent ? (
                  <span className="text-center text-xs text-zinc-500 border border-white/10 rounded-xl py-2">
                    Current plan
                  </span>
                ) : isUpgrade ? (
                  <button
                    onClick={() => upgrade(plan.id)}
                    disabled={!!loading}
                    className="btn-primary py-2.5 disabled:opacity-40"
                  >
                    {loading === plan.id ? 'Redirecting…' : `Upgrade to ${plan.name}`}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-zinc-600 text-center">
          Payments processed by Stripe · Cancel anytime · Enterprise plans available — contact us
        </p>
      </main>
    </div>
  );
}
