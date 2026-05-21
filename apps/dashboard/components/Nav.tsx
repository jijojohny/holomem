'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearApiKey } from '../lib/api';

const links = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/keys', label: 'API Keys' },
  { href: '/sessions', label: 'Sessions' },
  { href: '/billing', label: 'Billing' },
];

export default function Nav() {
  const path = usePathname();
  const router = useRouter();

  function signOut() {
    clearApiKey();
    router.replace('/login');
  }

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-black/50 border-b border-white/8 px-6 py-3 flex items-center gap-6">
      <span className="font-semibold text-white tracking-tight mr-4">HoloMem</span>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`text-sm transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 rounded ${
            path.startsWith(l.href) ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {l.label}
        </Link>
      ))}
      <button
        onClick={signOut}
        className="ml-auto text-sm text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 rounded px-1"
      >
        Sign out
      </button>
    </nav>
  );
}
