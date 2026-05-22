'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { setApiKey, apiGet, apiPost, type Usage } from '../../lib/api';
import { useRedirectIfAuthed } from '../../lib/auth';

declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, cfg: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

export default function LoginPage() {
  useRedirectIfAuthed();

  const router = useRouter();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [keyInput, setKeyInput] = useState('');
  const [email, setEmail] = useState('');
  const [newKey, setNewKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const googleBtnRef = useRef<HTMLDivElement>(null);
  // Use a ref so the GSI callback always calls the latest handler
  const googleHandlerRef = useRef<(credential: string) => void>();

  googleHandlerRef.current = async (credential: string) => {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await apiPost<{ api_key: string; email: string }>('/v1/auth/google', { credential });
      setNewKey(result.api_key);
      setTab('signup'); // show key reveal UI
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  // Load Google Identity Services and render the button
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBtnRef.current) return;

    const existing = document.getElementById('gsi-script');
    if (existing) {
      // Script already loaded from a previous render — just re-render button
      if (window.google) renderGoogleButton();
      return;
    }

    const script = document.createElement('script');
    script.id = 'gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => renderGoogleButton();
    document.head.appendChild(script);
  }, [tab]);

  function renderGoogleButton() {
    if (!googleBtnRef.current || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (r) => googleHandlerRef.current?.(r.credential),
    });
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: 'filled_black',
      size: 'large',
      width: googleBtnRef.current.offsetWidth || 360,
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'center',
    });
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      setApiKey(keyInput.trim());
      await apiGet<Usage>('/v1/usage');
      router.push('/dashboard');
    } catch {
      setApiKey('');
      setError('Invalid API key. Check for typos or generate a new one.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGetKey(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await apiPost<{ api_key: string }>('/v1/keys', { email: email.trim() });
      setNewKey(result.api_key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function copyKey() {
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function proceedWithNewKey() {
    setApiKey(newKey);
    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#0a0a0a]">
      {/* Background orb */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <a href="/" className="inline-flex items-center gap-2 mb-8 text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
          ← Back
        </a>

        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-8">
          <h1 className="text-xl font-semibold text-white mb-1">HoloMem</h1>
          <p className="text-zinc-400 text-sm mb-6">Encrypted memory for AI agents</p>

          {/* Tab switcher */}
          <div className="flex border border-white/10 rounded-lg overflow-hidden mb-6">
            {(['signin', 'signup'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); setNewKey(''); }}
                className={`flex-1 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent ${
                  tab === t ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t === 'signin' ? 'Sign in' : 'Get API key'}
              </button>
            ))}
          </div>

          {/* ── Sign in tab ── */}
          {tab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-3">
              <label className="block">
                <span className="text-xs text-zinc-400 mb-1.5 block">API key</span>
                <input
                  type="text"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="hm_live_..."
                  autoComplete="off"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm font-mono placeholder-zinc-600 text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </label>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={!keyInput.trim() || loading}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg py-2.5 transition-colors"
              >
                {loading ? 'Checking…' : 'Sign in'}
              </button>

              <p className="text-xs text-zinc-600 text-center pt-1">
                Don&apos;t have a key?{' '}
                <button
                  type="button"
                  onClick={() => setTab('signup')}
                  className="text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Get one →
                </button>
              </p>
            </form>
          )}

          {/* ── Get API key tab ── */}
          {tab === 'signup' && !newKey && (
            <div className="space-y-4">
              {/* Google sign-in */}
              {GOOGLE_CLIENT_ID ? (
                <>
                  {googleLoading ? (
                    <div className="w-full h-10 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center">
                      <span className="text-sm text-zinc-400">Signing in with Google…</span>
                    </div>
                  ) : (
                    <div ref={googleBtnRef} className="w-full overflow-hidden rounded-lg" />
                  )}

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs text-zinc-600">or</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                </>
              ) : null}

              {/* Email form */}
              <form onSubmit={handleGetKey} className="space-y-3">
                <label className="block">
                  <span className="text-xs text-zinc-400 mb-1.5 block">Email address</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-zinc-600 text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                  />
                </label>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button
                  type="submit"
                  disabled={!email.trim() || loading}
                  className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg py-2.5 transition-colors"
                >
                  {loading ? 'Generating…' : 'Generate API key'}
                </button>
              </form>
            </div>
          )}

          {/* ── Key reveal (both signup paths land here) ── */}
          {tab === 'signup' && newKey && (
            <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <p className="text-xs text-zinc-400 mb-2">Your API key — shown once, save it now</p>
                <p className="font-mono text-sm text-white break-all">{newKey}</p>
              </div>
              <button
                onClick={copyKey}
                className="w-full border border-white/10 hover:border-white/20 text-sm text-zinc-300 rounded-lg py-2.5 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                {copied ? '✓ Copied' : 'Copy key'}
              </button>
              <button
                onClick={proceedWithNewKey}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg py-2.5 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                Continue to dashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
