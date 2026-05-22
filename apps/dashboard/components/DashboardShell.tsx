'use client';

import Nav from './Nav';

interface Props {
  children: React.ReactNode;
}

export default function DashboardShell({ children }: Props) {
  return (
    <div className="flex min-h-screen" style={{ background: '#080810' }}>
      <Nav />

      {/* Content area — offset by sidebar width */}
      <div className="flex-1 flex flex-col min-w-0" style={{ marginLeft: '210px' }}>

        {/* Top bar */}
        <header
          className="sticky top-0 z-30 flex items-center gap-4 px-6 py-3"
          style={{ background: 'rgba(8,8,16,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          {/* Search */}
          <div className="flex-1 max-w-md relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
              <path d="m9 9 2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="SEARCH NODES, AGENTS, OR TRANSACTION HASH..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-8 pr-4 py-2 text-[10px] font-semibold tracking-[0.1em] text-zinc-600 placeholder-zinc-700 focus:outline-none focus:border-violet-500/40 focus:text-zinc-400 transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {/* Live badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-[0.12em] uppercase text-zinc-400"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              Live on Testnet
            </div>

            {/* Get API key */}
            <a
              href="/keys"
              className="hidden sm:block text-[10px] font-bold tracking-[0.12em] uppercase text-white px-3 py-1.5 rounded-lg transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}
            >
              Get API Key
            </a>

            {/* Bell */}
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              aria-label="Notifications">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M7 1.5A3.5 3.5 0 0 0 3.5 5v2.5L2 9h10l-1.5-1.5V5A3.5 3.5 0 0 0 7 1.5ZM5.5 9.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Avatar */}
            <div className="w-8 h-8 rounded-lg bg-violet-700/60 border border-violet-500/30 flex items-center justify-center text-[11px] font-bold text-violet-200">
              U
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
