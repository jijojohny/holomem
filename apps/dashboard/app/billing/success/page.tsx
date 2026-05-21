'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useRequireAuth } from '../../../lib/auth';

export default function BillingSuccessPage() {
  useRequireAuth();
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.replace('/dashboard'), 5000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-card p-12 text-center max-w-sm w-full space-y-4">
        <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-2xl">
          ✓
        </div>
        <h1 className="text-xl font-semibold">Payment successful</h1>
        <p className="text-zinc-400 text-sm">Your plan has been upgraded. Redirecting to dashboard…</p>
        <button
          onClick={() => router.replace('/dashboard')}
          className="text-sm text-violet-400 hover:text-violet-300 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
        >
          Go now →
        </button>
      </div>
    </div>
  );
}
