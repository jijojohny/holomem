'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearApiKey } from '../lib/api';

const NAV = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      </svg>
    ),
  },
  {
    href: '/sessions',
    label: 'Agent Nodes',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
        <circle cx="2.5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <circle cx="13.5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <circle cx="2.5" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <circle cx="13.5" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M4 4.5 6 6.5M10 6.5 12 4.5M4 11.5 6 9.5M10 9.5 12 11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/memories',
    label: 'Memory Mesh',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 1.5C4.41 1.5 1.5 4.41 1.5 8S4.41 14.5 8 14.5 14.5 11.59 14.5 8 11.59 1.5 8 1.5Z" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M1.5 8h13M8 1.5C6.5 3.5 5.5 5.6 5.5 8s1 4.5 2.5 6.5M8 1.5C9.5 3.5 10.5 5.6 10.5 8s-1 4.5-2.5 6.5" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
  },
  {
    href: '/keys',
    label: 'API Keys',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="6" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M9 8h6M12 6.5V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/webhooks',
    label: 'Security Logs',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 1.5 2 4v4.5c0 3 2.67 5.3 6 6 3.33-.7 6-3 6-6V4L8 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M5.5 8 7 9.5 10.5 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/swarm',
    label: 'Swarm',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 1.5 9.5 6h4.5l-3.5 2.5 1.5 4.5L8 10.5l-4 2.5 1.5-4.5L2 6h4.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/teams',
    label: 'Teams',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="6" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
        <circle cx="12" cy="5.5" r="2" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M1 13c0-2.21 2.24-4 5-4s5 1.79 5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M12 9c1.66 0 3 1.34 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const BOTTOM = [
  {
    href: '/docs',
    label: 'Docs',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2" y="1.5" width="10" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M8 1.5v1.3M8 13.2v1.3M1.5 8h1.3M13.2 8h1.3M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function Nav() {
  const path = usePathname();
  const router = useRouter();

  function signOut() {
    clearApiKey();
    router.replace('/login');
  }

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-[210px] flex flex-col z-40"
      style={{ background: '#0c0c0f', borderRight: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-black text-white">H</span>
          </div>
          <div>
            <p className="text-[14px] font-bold text-white tracking-tight leading-none">HoloMem</p>
            <p className="text-[9px] text-zinc-600 tracking-[0.18em] uppercase mt-0.5">V0.4.2 Sovereign</p>
          </div>
        </div>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 px-3 pt-4 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const active = path === item.href || (item.href !== '/dashboard' && path.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
              style={{
                color: active ? '#fff' : 'rgba(161,161,170,0.8)',
                background: active ? 'rgba(124,58,237,0.15)' : 'transparent',
              }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-violet-500 rounded-r-full" />
              )}
              <span style={{ color: active ? 'rgb(167,139,250)' : 'rgba(113,113,122,1)' }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Deploy Node CTA */}
      <div className="px-3 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button
          onClick={() => router.push('/keys')}
          className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-bold tracking-[0.08em] uppercase py-2.5 rounded-lg transition-all mt-4 mb-3 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <path d="M6.5 1.5v10M1.5 6.5h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Deploy Node
        </button>

        {BOTTOM.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}

        <button
          onClick={signOut}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-zinc-600 hover:text-zinc-400 transition-colors w-full text-left"
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10.5 11 14 8l-3.5-3M14 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}
