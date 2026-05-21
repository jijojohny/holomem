'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getApiKey } from '../lib/api';
import { useRouter } from 'next/navigation';

const features = [
  {
    icon: '🔐',
    title: 'Client-side encryption',
    body: 'Data is encrypted before it leaves your machine. The HoloMem server never sees your plaintext — only ciphertext arrives on-chain.',
  },
  {
    icon: '🔗',
    title: 'On-chain reasoning graph',
    body: "Every memory node and relationship edge is written to Arkiv's L3 DB-Chain, creating an auditable, verifiable trace of your agent's reasoning.",
  },
  {
    icon: '⏱',
    title: 'Auto-expiring memory tiers',
    body: 'Working memory auto-prunes in minutes, episodic memory in hours, and persistent reports last 30 days — no manual cleanup required.',
  },
  {
    icon: '🤝',
    title: 'Multi-agent shared state',
    body: 'Planner, executor, and consolidator agents share encrypted memory across sessions without a central coordinator.',
  },
  {
    icon: '📦',
    title: 'Drop-in SDKs',
    body: 'TypeScript and Python SDKs with a single class. LangChain adapter included. Swap in HoloMem in minutes, not days.',
  },
  {
    icon: '🔒',
    title: 'You own your data',
    body: 'Your encryption key never leaves your environment. Revoke access, rotate keys, and export your memory graph at any time.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Write encrypted memory',
    body: 'Your agent encrypts context client-side and writes it to Arkiv. The server only ever receives ciphertext.',
  },
  {
    number: '02',
    title: 'Share across agents',
    body: 'Planner, executor, and consolidator agents read the same encrypted memory pool and build a shared reasoning graph.',
  },
  {
    number: '03',
    title: 'Auto-prune on schedule',
    body: 'Working memory expires in minutes, episodic in hours. No cleanup code — TTLs are set at write time.',
  },
];

const pricing = [
  {
    tier: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For prototyping and hobby projects',
    limit: '1,000 memory writes / month',
    cta: 'Get started',
    href: '/login',
    highlight: false,
  },
  {
    tier: 'Pro',
    price: '$49',
    period: 'per month',
    description: 'For production agents and small teams',
    limit: '50,000 memory writes / month',
    cta: 'Start free trial',
    href: '/login',
    highlight: true,
  },
  {
    tier: 'Team',
    price: '$199',
    period: 'per month',
    description: 'For large-scale agent deployments',
    limit: '500,000 memory writes / month',
    cta: 'Contact us',
    href: 'mailto:hi@holomem.dev',
    highlight: false,
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (getApiKey()) {
      router.replace('/dashboard');
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) return null;

  return (
    <div className="min-h-screen text-white overflow-x-hidden">

      {/* Sticky glass nav */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-black/50 border-b border-white/8">
        <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <span className="font-semibold text-white tracking-tight text-lg">HoloMem</span>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-zinc-400">
            <a href="#how-it-works" className="hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 rounded px-1">
              How it works
            </a>
            <a href="#features" className="hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 rounded px-1">
              Features
            </a>
            <a href="#pricing" className="hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 rounded px-1">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-zinc-400 hover:text-white transition-colors px-3 py-1.5 focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="text-sm bg-violet-600 hover:bg-violet-500 text-white font-medium px-4 py-1.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Get API key
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative text-center px-6 pt-24 pb-16 max-w-4xl mx-auto">
        {/* Live badge */}
        <div className="inline-flex items-center gap-2 backdrop-blur-md bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs text-zinc-400 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          Live on Arkiv Braga testnet
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight mb-6">
          Encrypted memory mesh
          <br />
          <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            for AI agent swarms
          </span>
        </h1>

        <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          HoloMem gives autonomous AI agents shared, private, self-pruning memory on-chain.
          Client-side encrypted. Auto-expiring. You own the keys.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
          <Link
            href="/login"
            className="w-full sm:w-auto bg-violet-600 hover:bg-violet-500 text-white font-medium px-8 py-3 rounded-xl transition-colors text-sm focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Get your API key — free
          </Link>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto backdrop-blur-md bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white font-medium px-8 py-3 rounded-xl transition-colors text-sm"
          >
            See how it works
          </a>
        </div>

        {/* Stats strip */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-16">
          {[
            { label: 'TypeScript SDK', icon: '⚡' },
            { label: 'Python SDK', icon: '🐍' },
            { label: 'LangChain adapter', icon: '🦜' },
            { label: '30-day persistent TTL', icon: '⏱' },
            { label: 'ECIES encrypted', icon: '🔐' },
          ].map((s) => (
            <span
              key={s.label}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 backdrop-blur-md bg-white/5 border border-white/8 rounded-full px-3 py-1.5"
            >
              <span>{s.icon}</span>
              {s.label}
            </span>
          ))}
        </div>

        {/* Code preview */}
        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 text-left max-w-2xl mx-auto">
          <div className="flex items-center gap-1.5 mb-4">
            <span className="w-3 h-3 rounded-full bg-red-500/60" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <span className="w-3 h-3 rounded-full bg-green-500/60" />
            <span className="ml-auto text-xs text-zinc-600 font-mono">agent.ts</span>
          </div>
          <pre className="text-xs font-mono leading-relaxed overflow-x-auto">
            <span className="text-zinc-500">{'// Drop-in encrypted memory for any AI agent\n'}</span>
            <span className="text-violet-400">{'import'}</span>
            {' { HoloMem } '}
            <span className="text-violet-400">{'from'}</span>
            {' '}
            <span className="text-emerald-400">{"'@holomem/sdk'"}</span>
            {'\n\n'}
            <span className="text-zinc-300">{'const mem = new HoloMem({\n'}</span>
            <span className="text-zinc-300">{'  apiKey: process.env.HOLOMEM_API_KEY,\n'}</span>
            <span className="text-zinc-300">{'  encryptionKey: process.env.ENCRYPTION_KEY,  '}</span>
            <span className="text-zinc-500">{'// never leaves your env\n'}</span>
            <span className="text-zinc-300">{'});\n\n'}</span>
            <span className="text-zinc-500">{'// Encrypted on-chain — server sees only ciphertext\n'}</span>
            <span className="text-zinc-300">{'await mem.write({ sessionId: '}</span>
            <span className="text-emerald-400">{"'research-42'"}</span>
            <span className="text-zinc-300">{', context, ttl: '}</span>
            <span className="text-emerald-400">{"'1h'"}</span>
            <span className="text-zinc-300">{'});'}</span>
          </pre>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-6 py-24 max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold tracking-tight mb-4">How it works</h2>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Three steps to give any AI agent permanent, private memory.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
          {/* Connector line (desktop) */}
          <div className="hidden md:block absolute top-10 left-[calc(33.3%+1rem)] right-[calc(33.3%+1rem)] h-px bg-gradient-to-r from-white/10 via-violet-500/30 to-white/10" />

          {steps.map((s) => (
            <div key={s.number} className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 relative">
              <div className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-xs font-mono text-violet-400 mb-4">
                {s.number}
              </div>
              <h3 className="font-semibold text-white mb-2 text-sm">{s.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-24 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Built for agent-native workflows</h2>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Everything you need to give your AI agents persistent, private, verifiable memory.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/[0.08] hover:border-white/15 transition-colors"
            >
              <div className="text-2xl mb-4">{f.icon}</div>
              <h3 className="font-semibold text-white mb-2 text-sm">{f.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-24 max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Simple, transparent pricing</h2>
          <p className="text-zinc-400">Start free. Scale as your agents grow.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {pricing.map((p) => (
            <div
              key={p.tier}
              className={`backdrop-blur-md border rounded-2xl p-6 flex flex-col ${
                p.highlight
                  ? 'bg-violet-600/10 border-violet-500/40 ring-1 ring-violet-500/20'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              {p.highlight && (
                <span className="text-xs font-medium text-violet-300 bg-violet-500/20 border border-violet-500/30 rounded-full px-3 py-0.5 self-start mb-4">
                  Most popular
                </span>
              )}
              <div className="mb-3">
                <p className="text-sm text-zinc-400 font-medium">{p.tier}</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-bold text-white">{p.price}</span>
                  <span className="text-zinc-500 text-sm">/{p.period}</span>
                </div>
              </div>
              <p className="text-sm text-zinc-400 mb-1">{p.description}</p>
              <p className="text-xs text-zinc-500 mb-6">{p.limit}</p>
              <Link
                href={p.href}
                className={`mt-auto text-center text-sm font-medium py-2.5 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-violet-400 ${
                  p.highlight
                    ? 'bg-violet-600 hover:bg-violet-500 text-white'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white'
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className="px-6 py-24 max-w-4xl mx-auto text-center">
        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-3xl px-8 py-16 relative overflow-hidden">
          {/* Inner glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-indigo-600/10 pointer-events-none" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              Ready to give your agents memory?
            </h2>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto">
              Free API key in 30 seconds. No credit card required.
            </p>
            <Link
              href="/login"
              className="inline-block bg-violet-600 hover:bg-violet-500 text-white font-medium px-10 py-3 rounded-xl transition-colors text-sm focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              Get started for free
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8 max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-600">
        <span className="font-semibold text-zinc-500 tracking-tight">HoloMem</span>
        <div className="flex items-center gap-6">
          <a href="#how-it-works" className="hover:text-zinc-400 transition-colors">How it works</a>
          <a href="#features" className="hover:text-zinc-400 transition-colors">Features</a>
          <a href="#pricing" className="hover:text-zinc-400 transition-colors">Pricing</a>
          <Link href="/login" className="hover:text-zinc-400 transition-colors">Sign in</Link>
        </div>
        <span>© 2026 HoloMem</span>
      </footer>
    </div>
  );
}
