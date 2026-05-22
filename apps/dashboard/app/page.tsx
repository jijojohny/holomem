'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getApiKey } from '../lib/api';
import { useRouter } from 'next/navigation';

/* ─── Data ─────────────────────────────────────────────────────────────── */

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
];

const CHIPS = [
  { icon: '⚡', label: 'TypeScript SDK' },
  { icon: '🐍', label: 'Python SDK' },
  { icon: '🦜', label: 'LangChain Adapter' },
  { icon: '⏱', label: '30-Day TTL' },
];

const STEPS = [
  {
    n: '01',
    title: 'Write encrypted memory',
    body: 'Your agent encrypts context client-side and writes it to Arkiv. The server only ever receives ciphertext.',
  },
  {
    n: '02',
    title: 'Share across agents',
    body: 'Planner, executor, and consolidator agents read the same encrypted pool and build a shared reasoning graph.',
  },
  {
    n: '03',
    title: 'Auto-prune on schedule',
    body: 'Working memory expires in minutes, episodic in hours. No cleanup code — TTLs are set at write time.',
  },
];

const FEATURES = [
  {
    title: 'Client-side encryption',
    body: 'Data is encrypted before it leaves your machine. HoloMem never sees your plaintext — only ciphertext arrives on-chain.',
  },
  {
    title: 'On-chain reasoning graph',
    body: "Every memory node and relationship edge is written to Arkiv's L3 DB-Chain, creating an auditable trace of your agent's reasoning.",
  },
  {
    title: 'Auto-expiring memory tiers',
    body: 'Working memory auto-prunes in minutes, episodic in hours, persistent reports last 30 days — no manual cleanup needed.',
  },
  {
    title: 'Multi-agent shared state',
    body: 'Planner, executor, and consolidator agents share encrypted memory across sessions without a central coordinator.',
  },
  {
    title: 'Drop-in SDKs',
    body: 'TypeScript and Python SDKs with a single class. LangChain adapter included. Swap in HoloMem in minutes.',
  },
  {
    title: 'You own your data',
    body: 'Your encryption key never leaves your environment. Revoke access, rotate keys, and export your memory graph anytime.',
  },
];

const PRICING = [
  {
    tier: 'Free',
    price: '$0',
    period: '/month',
    description: 'For prototyping and hobby projects',
    limit: '1,000 memory writes / month',
    cta: 'Get started free',
    href: '/login',
    highlight: false,
  },
  {
    tier: 'Pro',
    price: '$49',
    period: '/month',
    description: 'For production agents and small teams',
    limit: '50,000 memory writes / month',
    cta: 'Start free trial',
    href: '/login',
    highlight: true,
  },
  {
    tier: 'Team',
    price: '$199',
    period: '/month',
    description: 'For large-scale agent deployments',
    limit: '500,000 memory writes / month',
    cta: 'Contact us',
    href: 'mailto:hi@holomem.dev',
    highlight: false,
  },
];

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (getApiKey()) {
      router.replace('/dashboard');
    } else {
      setChecked(true);
    }
  }, [router]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!checked) return null;

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: '#060606' }}>

      {/* Dot-grid texture */}
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
        }}
      />

      {/* Top radial glow — hero spotlight */}
      <div
        className="fixed top-0 left-0 right-0 h-[600px] pointer-events-none -z-10"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(109,40,217,0.18) 0%, transparent 70%)',
        }}
      />

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(6,6,6,0.88)' : 'transparent',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        }}
      >
        <div className="flex items-center justify-between px-6 sm:px-10 py-4 max-w-6xl mx-auto">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 focus-visible:ring-2 focus-visible:ring-violet-500 rounded">
            <div className="w-6 h-6 rounded-md bg-violet-600 flex items-center justify-center">
              <span className="text-[10px] font-black text-white">H</span>
            </div>
            <span className="font-bold text-white text-[15px] tracking-tight">HoloMem</span>
          </Link>

          {/* Center nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="px-3 py-1.5 text-[13px] font-medium text-zinc-400 hover:text-white rounded-md hover:bg-white/[0.05] transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden sm:block px-3 py-1.5 text-[13px] font-medium text-zinc-400 hover:text-white rounded-md hover:bg-white/[0.05] transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-semibold px-4 py-1.5 rounded-lg transition-all hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060606]"
            >
              Get API key
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2.5 6h7m-3-3 3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative text-center px-6 pt-40 pb-24 max-w-5xl mx-auto">

        {/* Live badge */}
        <div className="inline-flex items-center gap-2 mb-8 px-3.5 py-1.5 rounded-full text-[11px] font-semibold tracking-wide"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="text-zinc-400 uppercase tracking-widest" style={{ fontSize: '10px' }}>
            Live on Arkiv Braga Testnet
          </span>
        </div>

        {/* Headline */}
        <h1
          className="font-extrabold tracking-tight text-white mb-6 mx-auto"
          style={{
            fontSize: 'clamp(2.8rem, 6.5vw, 5.25rem)',
            lineHeight: 1.06,
            letterSpacing: '-0.035em',
            maxWidth: '860px',
          }}
        >
          Encrypted memory mesh
          <br />
          <span
            style={{
              backgroundImage: 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 40%, #7c3aed 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            for AI agent swarms
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-[17px] text-zinc-400 leading-relaxed mb-10 mx-auto" style={{ maxWidth: '520px' }}>
          HoloMem gives autonomous AI agents shared, private, self-pruning memory on-chain.
          Client-side encrypted. Auto-expiring. You own the keys.
        </p>

        {/* CTA row */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-[14px] px-7 py-3 rounded-xl transition-all hover:shadow-[0_8px_30px_rgba(124,58,237,0.35)] focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060606]"
          >
            Get your API key — free
          </Link>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-white font-semibold text-[14px] px-7 py-3 rounded-xl transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            See how it works
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2.5 7h9M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>

        {/* Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {CHIPS.map((c) => (
            <span
              key={c.label}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '999px',
                padding: '5px 14px',
              }}
            >
              <span className="text-[13px]">{c.icon}</span>
              {c.label}
            </span>
          ))}
        </div>
      </section>

      {/* ── Code preview ───────────────────────────────────────────────── */}
      <section className="px-6 pb-32 max-w-3xl mx-auto">
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.07)', background: '#0e0e10' }}
        >
          {/* Window chrome */}
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-auto font-mono text-[11px] text-zinc-600">agent.ts</span>
          </div>
          {/* Code */}
          <pre className="p-6 text-[12.5px] font-mono leading-[1.8] overflow-x-auto">
            <span className="text-zinc-600">{'// Drop-in encrypted memory for any AI agent\n'}</span>
            <span className="text-violet-400">import</span>
            <span className="text-white">{' { HoloMem } '}</span>
            <span className="text-violet-400">from</span>
            <span className="text-emerald-300">{" '@holomem/sdk';\n\n"}</span>

            <span className="text-zinc-500">{'// Your encryption key never leaves this environment\n'}</span>
            <span className="text-sky-400">const</span>
            <span className="text-white">{' mem = '}</span>
            <span className="text-sky-400">new</span>
            <span className="text-yellow-300">{' HoloMem'}</span>
            <span className="text-white">{'({\n'}</span>
            <span className="text-white">{'  apiKey: '}</span>
            <span className="text-zinc-300">{'process.env'}</span>
            <span className="text-white">{'.'}</span>
            <span className="text-emerald-300">{'HOLOMEM_API_KEY'}</span>
            <span className="text-white">{';\n'}</span>
            <span className="text-white">{'  encryptionKey: '}</span>
            <span className="text-zinc-300">{'process.env'}</span>
            <span className="text-white">{'.'}</span>
            <span className="text-emerald-300">{'ENCRYPTION_KEY'}</span>
            <span className="text-white">{';\n'}</span>
            <span className="text-white">{'});\n\n'}</span>

            <span className="text-zinc-500">{'// Server only ever receives ciphertext\n'}</span>
            <span className="text-sky-400">await</span>
            <span className="text-white">{' mem.'}</span>
            <span className="text-yellow-300">{'write'}</span>
            <span className="text-white">{'({ sessionId: '}</span>
            <span className="text-emerald-300">{"'research-42'"}</span>
            <span className="text-white">{', context, ttl: '}</span>
            <span className="text-emerald-300">{"'1h'"}</span>
            <span className="text-white">{' });\n\n'}</span>

            <span className="text-zinc-500">{'// Recall across agents — decrypted only on your machine\n'}</span>
            <span className="text-sky-400">const</span>
            <span className="text-white">{' memories = '}</span>
            <span className="text-sky-400">await</span>
            <span className="text-white">{' mem.'}</span>
            <span className="text-yellow-300">{'recall'}</span>
            <span className="text-white">{'({ sessionId: '}</span>
            <span className="text-emerald-300">{"'research-42'"}</span>
            <span className="text-white">{' });'}</span>
          </pre>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section id="how-it-works" className="px-6 py-28 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-violet-400 mb-4">How it works</p>
          <h2
            className="font-bold text-white mb-4"
            style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', letterSpacing: '-0.025em', lineHeight: 1.15 }}
          >
            From code to on-chain memory<br />in three steps
          </h2>
          <p className="text-zinc-500 text-[15px] leading-relaxed mx-auto" style={{ maxWidth: '420px' }}>
            Give any AI agent persistent, private, verifiable memory without changing your architecture.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.06)', boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}>
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className="p-8 relative group"
              style={{ background: '#060606' }}
            >
              {/* Step number */}
              <div
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-6 text-[12px] font-bold font-mono text-violet-300"
                style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}
              >
                {s.n}
              </div>
              <h3 className="text-[15px] font-semibold text-white mb-2 tracking-tight">{s.title}</h3>
              <p className="text-[13.5px] text-zinc-500 leading-relaxed">{s.body}</p>

              {/* Connector arrow between cards (desktop) */}
              {i < 2 && (
                <div className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-5 h-5 rounded-full items-center justify-center"
                  style={{ background: '#060606', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                    <path d="M2 4h4M4 2l2 2-2 2" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section id="features" className="px-6 py-28 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-violet-400 mb-4">Features</p>
          <h2
            className="font-bold text-white mb-4"
            style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', letterSpacing: '-0.025em', lineHeight: 1.15 }}
          >
            Built for agent-native workflows
          </h2>
          <p className="text-zinc-500 text-[15px] leading-relaxed mx-auto" style={{ maxWidth: '420px' }}>
            Everything you need to give AI agents persistent, private, verifiable memory.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.06)', boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}>
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="p-8 group transition-colors relative overflow-hidden"
              style={{ background: '#060606' }}
            >
              {/* Hover top accent */}
              <div className="absolute top-0 left-6 right-6 h-px transition-opacity opacity-0 group-hover:opacity-100"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.5), transparent)' }} />
              <h3 className="text-[14px] font-semibold text-white mb-2 tracking-tight">{f.title}</h3>
              <p className="text-[13px] text-zinc-500 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────── */}
      <section id="pricing" className="px-6 py-28 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-violet-400 mb-4">Pricing</p>
          <h2
            className="font-bold text-white mb-4"
            style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', letterSpacing: '-0.025em', lineHeight: 1.15 }}
          >
            Simple, transparent pricing
          </h2>
          <p className="text-zinc-500 text-[15px]">Start free. Scale as your agents grow.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PRICING.map((p) => (
            <div
              key={p.tier}
              className="relative rounded-2xl p-8 flex flex-col"
              style={{
                background: p.highlight ? 'rgba(109,40,217,0.07)' : 'rgba(255,255,255,0.025)',
                border: p.highlight ? '1px solid rgba(139,92,246,0.35)' : '1px solid rgba(255,255,255,0.07)',
                boxShadow: p.highlight ? '0 0 40px rgba(109,40,217,0.12)' : 'none',
              }}
            >
              {p.highlight && (
                <>
                  {/* Top glow line */}
                  <div className="absolute top-0 left-8 right-8 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.6), transparent)' }} />
                  <span
                    className="self-start text-[10px] font-bold tracking-[0.15em] uppercase text-violet-300 mb-5 px-2.5 py-1 rounded-md"
                    style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}
                  >
                    Most popular
                  </span>
                </>
              )}

              <div className="mb-1">
                <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-zinc-500 mb-3">{p.tier}</p>
                <div className="flex items-end gap-1">
                  <span className="text-[2.75rem] font-bold text-white leading-none" style={{ letterSpacing: '-0.03em' }}>
                    {p.price}
                  </span>
                  <span className="text-zinc-600 text-[13px] mb-1.5">{p.period}</span>
                </div>
              </div>

              <p className="text-[13.5px] text-zinc-400 mt-3 mb-1">{p.description}</p>
              <p className="text-[12px] text-zinc-600 mb-8">{p.limit}</p>

              <Link
                href={p.href}
                className={`mt-auto text-center text-[13px] font-semibold py-2.5 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-violet-400 ${
                  p.highlight
                    ? 'bg-violet-600 hover:bg-violet-500 text-white hover:shadow-[0_8px_25px_rgba(124,58,237,0.3)]'
                    : 'text-zinc-300 hover:text-white'
                }`}
                style={
                  !p.highlight
                    ? { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }
                    : {}
                }
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────────────────────────────── */}
      <section className="px-6 py-28 max-w-4xl mx-auto text-center">
        <div
          className="relative rounded-3xl px-10 py-20 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Radial glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 70% 80% at 50% 50%, rgba(109,40,217,0.13) 0%, transparent 70%)' }}
          />
          {/* Top accent line */}
          <div
            className="absolute top-0 left-16 right-16 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.5), transparent)' }}
          />
          <div className="relative">
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-violet-400 mb-5">Get started</p>
            <h2
              className="font-bold text-white mb-4 mx-auto"
              style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', letterSpacing: '-0.025em', lineHeight: 1.15, maxWidth: '520px' }}
            >
              Ready to give your agents memory?
            </h2>
            <p className="text-zinc-500 text-[15px] mb-10 mx-auto leading-relaxed" style={{ maxWidth: '380px' }}>
              Free API key in 30 seconds. No credit card. No infrastructure to manage.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-[14px] px-8 py-3.5 rounded-xl transition-all hover:shadow-[0_8px_30px_rgba(124,58,237,0.35)] focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              Get started for free
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2.5 7h9M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="px-6 sm:px-10 py-10 max-w-6xl mx-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-violet-500 rounded">
            <div className="w-5 h-5 rounded-md bg-violet-600/80 flex items-center justify-center">
              <span className="text-[9px] font-black text-white">H</span>
            </div>
            <span className="font-bold text-zinc-600 text-[13px] tracking-tight">HoloMem</span>
          </Link>

          <nav className="flex items-center gap-6">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-[12px] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                {l.label}
              </a>
            ))}
            <Link href="/login" className="text-[12px] text-zinc-600 hover:text-zinc-400 transition-colors">
              Sign in
            </Link>
          </nav>

          <p className="text-[12px] text-zinc-700">© 2026 HoloMem. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
