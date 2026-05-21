'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '../../components/Nav';
import { apiGet, AuthError, type Session } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function SessionsPage() {
  useRequireAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ sessions: Session[] }>('/v1/sessions')
      .then((d) => setSessions(d.sessions))
      .catch((e) => { if (e instanceof AuthError) router.replace('/login'); })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-2xl mx-auto px-6 py-10 space-y-4">
        <h1 className="text-xl font-semibold">Sessions</h1>

        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="p-6 animate-pulse h-32" />
          ) : sessions.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-zinc-500 text-sm">No sessions yet.</p>
              <p className="text-zinc-600 text-xs mt-1">Write your first memory using the SDK to see sessions here.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-zinc-500 text-xs">
                  <th className="text-left px-5 py-3">Session ID</th>
                  <th className="text-right px-5 py-3">Memories</th>
                  <th className="text-right px-5 py-3">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.session_id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                    <td className="px-5 py-3 font-mono text-zinc-300 max-w-xs truncate">{s.session_id}</td>
                    <td className="px-5 py-3 text-right text-zinc-400">{s.memory_count}</td>
                    <td className="px-5 py-3 text-right text-zinc-400">{timeAgo(s.last_activity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
