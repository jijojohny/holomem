'use client';

import { useState, useEffect, useRef } from 'react';
import DashboardShell from '../../components/DashboardShell';

/* ─── Syntax highlighter (static content only — no user input) ─────────── */
function hl(code: string, lang: 'ts' | 'bash' | 'http' = 'ts'): string {
  let s = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (lang === 'bash') {
    s = s
      .replace(/(#[^\n]*)/g, '<em style="color:#52525b;font-style:normal">$1</em>')
      .replace(/\b(npm|npx|export|echo|node)\b/g, '<em style="color:#a78bfa;font-style:normal">$1</em>')
      .replace(/("[^"]*")/g, '<em style="color:#34d399;font-style:normal">$1</em>');
    return s;
  }

  if (lang === 'http') {
    s = s
      .replace(/^(POST|GET|DELETE|PUT|PATCH)/gm, '<em style="color:#fbbf24;font-style:normal">$1</em>')
      .replace(/(Authorization|Content-Type):/g, '<em style="color:#38bdf8;font-style:normal">$1</em>:')
      .replace(/("[^"]*")/g, '<em style="color:#34d399;font-style:normal">$1</em>')
      .replace(/(Bearer .+)/g, '<em style="color:#a78bfa;font-style:normal">$1</em>');
    return s;
  }

  // TypeScript — order matters: comments and strings first, then keywords
  const PLACEHOLDER = '\x00';
  const saved: string[] = [];

  // Preserve block comments
  s = s.replace(/(\/\*[\s\S]*?\*\/)/g, (m) => { saved.push(`<em style="color:#52525b;font-style:normal">${m}</em>`); return PLACEHOLDER + (saved.length - 1) + PLACEHOLDER; });
  // Preserve line comments
  s = s.replace(/(\/\/[^\n]*)/g, (m) => { saved.push(`<em style="color:#52525b;font-style:normal">${m}</em>`); return PLACEHOLDER + (saved.length - 1) + PLACEHOLDER; });
  // Preserve template literals
  s = s.replace(/(`[^`]*`)/g, (m) => { saved.push(`<em style="color:#34d399;font-style:normal">${m}</em>`); return PLACEHOLDER + (saved.length - 1) + PLACEHOLDER; });
  // Preserve strings
  s = s.replace(/('[^'\\]*(?:\\.[^'\\]*)*'|"[^"\\]*(?:\\.[^"\\]*)*")/g, (m) => { saved.push(`<em style="color:#34d399;font-style:normal">${m}</em>`); return PLACEHOLDER + (saved.length - 1) + PLACEHOLDER; });

  // Keywords
  s = s.replace(/\b(import|export|from|const|let|var|async|await|new|return|if|else|for|of|in|null|undefined|true|false|typeof|void|throw|try|catch)\b/g,
    '<em style="color:#a78bfa;font-style:normal">$1</em>');
  // Types and classes (PascalCase)
  s = s.replace(/\b([A-Z][A-Za-z0-9]+)\b/g, '<em style="color:#38bdf8;font-style:normal">$1</em>');
  // Numbers
  s = s.replace(/\b(\d+)\b/g, '<em style="color:#fbbf24;font-style:normal">$1</em>');

  // Restore saved tokens
  s = s.replace(new RegExp(PLACEHOLDER + '(\\d+)' + PLACEHOLDER, 'g'), (_, i) => saved[parseInt(i)]);

  return s;
}

/* ─── CodeBlock ─────────────────────────────────────────────────────────── */
function CodeBlock({ code, lang = 'ts', label }: { code: string; lang?: 'ts' | 'bash' | 'http'; label?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const langLabel = label ?? (lang === 'ts' ? 'TypeScript' : lang === 'bash' ? 'Terminal' : 'HTTP');

  return (
    <div className="rounded-xl overflow-hidden my-4" style={{ background: '#07070f', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* toolbar */}
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-zinc-600">{langLabel}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.1em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 rounded px-2 py-0.5"
          style={{ color: copied ? '#34d399' : 'rgba(113,113,122,0.7)' }}
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Copied
            </>
          ) : (
            <>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><rect x="0.5" y="2.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M2.5 2.5V1.5a1 1 0 0 1 1-1H8.5a1 1 0 0 1 1 1V7a1 1 0 0 1-1 1H8" stroke="currentColor" strokeWidth="1.2"/></svg>
              Copy
            </>
          )}
        </button>
      </div>
      {/* code */}
      <pre
        className="overflow-x-auto px-5 py-4 text-[12.5px] leading-[1.75] font-mono text-zinc-300"
        dangerouslySetInnerHTML={{ __html: hl(code.trim(), lang) }}
      />
    </div>
  );
}

/* ─── Section header ────────────────────────────────────────────────────── */
function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 pt-12 first:pt-0">
      <div className="mb-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h2 className="text-[20px] font-bold text-white tracking-tight">{title}</h2>
        {subtitle && <p className="text-[12px] text-zinc-500 mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

/* ─── Method card ───────────────────────────────────────────────────────── */
function Method({ signature, description, params, returns, children }: {
  signature: string;
  description: string;
  params?: { name: string; type: string; desc: string }[];
  returns?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-10">
      <div className="rounded-xl px-4 py-3 mb-3 font-mono text-[13px]" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
        <span className="text-violet-300">{signature}</span>
      </div>
      <p className="text-[13px] text-zinc-400 leading-relaxed mb-3">{description}</p>
      {params && params.length > 0 && (
        <div className="rounded-xl overflow-hidden mb-3" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="grid px-4 py-2" style={{ gridTemplateColumns: '130px 140px 1fr', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
            {['Parameter', 'Type', 'Description'].map((h) => (
              <p key={h} className="text-[9px] font-bold tracking-[0.16em] uppercase text-zinc-600">{h}</p>
            ))}
          </div>
          {params.map((p, i) => (
            <div key={p.name} className="grid items-start px-4 py-2.5 gap-2" style={{ gridTemplateColumns: '130px 140px 1fr', borderBottom: i < params.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <code className="text-[11px] font-mono text-violet-300">{p.name}</code>
              <code className="text-[11px] font-mono text-sky-400">{p.type}</code>
              <p className="text-[11px] text-zinc-500 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      )}
      {returns && (
        <p className="text-[12px] text-zinc-500 mb-3">
          <span className="font-bold text-zinc-400">Returns: </span>
          <code className="font-mono text-sky-400 text-[11px]">{returns}</code>
        </p>
      )}
      {children}
    </div>
  );
}

/* ─── Callout ───────────────────────────────────────────────────────────── */
function Callout({ type = 'info', children }: { type?: 'info' | 'warn' | 'tip'; children: React.ReactNode }) {
  const cfg = {
    info: { color: '#38bdf8', bg: 'rgba(56,189,248,0.07)', border: 'rgba(56,189,248,0.2)', icon: 'ℹ' },
    warn: { color: '#fbbf24', bg: 'rgba(251,191,36,0.07)', border: 'rgba(251,191,36,0.2)', icon: '⚠' },
    tip:  { color: '#34d399', bg: 'rgba(52,211,153,0.07)', border: 'rgba(52,211,153,0.2)',  icon: '✦' },
  }[type];
  return (
    <div className="flex gap-3 rounded-xl px-4 py-3.5 my-4 text-[12px] leading-relaxed" style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
      <span className="shrink-0 mt-0.5 font-bold">{cfg.icon}</span>
      <span style={{ color: 'rgba(212,212,216,0.85)' }}>{children}</span>
    </div>
  );
}

/* ─── TOC sections ──────────────────────────────────────────────────────── */
const TOC = [
  { id: 'quickstart',    label: 'Quick Start' },
  { id: 'install',       label: 'Installation' },
  { id: 'init',          label: 'Initialization' },
  { id: 'write',         label: 'write()' },
  { id: 'recall',        label: 'recall()' },
  { id: 'read',          label: 'read()' },
  { id: 'delete',        label: 'delete()' },
  { id: 'link',          label: 'link()' },
  { id: 'getGraph',      label: 'getGraph()' },
  { id: 'write-many',    label: 'writeMany()' },
  { id: 'list-memories', label: 'listMemories()' },
  { id: 'list-sessions', label: 'listSessions()' },
  { id: 'delete-session',label: 'deleteSession()' },
  { id: 'pin',           label: 'pin() / unpin()' },
  { id: 'search',        label: 'search()' },
  { id: 'usage-method',  label: 'usage()' },
  { id: 'entity-model',  label: 'Entity Model' },
  { id: 'tiers',         label: 'Memory Tiers' },
  { id: 'semantic',      label: 'Semantic Search' },
  { id: 'adapters',      label: 'Framework Adapters' },
  { id: 'teams',         label: 'Teams' },
  { id: 'encryption',    label: 'Encryption Keys' },
  { id: 'rest',          label: 'REST API' },
  { id: 'webhooks',      label: 'Webhooks' },
];

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function DocsPage() {
  const [active, setActive] = useState('quickstart');
  const mainRef = useRef<HTMLDivElement>(null);

  // Track which section is visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    TOC.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <DashboardShell>
      <div className="flex min-h-full">

        {/* ── Sticky TOC ────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-52 shrink-0 sticky top-0 self-start h-screen pt-8 pl-6 pr-4 overflow-y-auto">
          <p className="text-[9px] font-black tracking-[0.2em] uppercase text-zinc-600 mb-4">On this page</p>
          <nav className="space-y-0.5">
            {TOC.map(({ id, label }) => {
              const isActive = active === id;
              const isMethod = label.endsWith('()');
              return (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-[12px] transition-colors focus-visible:ring-2 focus-visible:ring-violet-500"
                  style={{
                    color: isActive ? '#c4b5fd' : 'rgba(113,113,122,0.8)',
                    background: isActive ? 'rgba(124,58,237,0.12)' : 'transparent',
                    paddingLeft: isMethod ? '20px' : undefined,
                    fontFamily: isMethod ? 'monospace' : undefined,
                    fontSize: isMethod ? '11px' : undefined,
                  }}
                >
                  {isActive && <span className="mr-1.5 text-violet-400">›</span>}
                  {label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Main content ──────────────────────────────────────────── */}
        <main ref={mainRef} className="flex-1 px-8 py-8 max-w-3xl">

          {/* Page header */}
          <div className="mb-10">
            <h1 className="text-[26px] font-bold text-white tracking-tight">Documentation</h1>
            <p className="text-[13px] text-zinc-500 mt-1.5">
              Everything you need to add encrypted persistent memory to your AI agents.
            </p>
          </div>

          {/* ── Quick Start ─────────────────────────────────────────── */}
          <Section id="quickstart" title="Quick Start" subtitle="From API key to first memory write in under 5 minutes.">
            <div className="grid grid-cols-1 gap-4 mb-6">
              {[
                { step: '1', title: 'Get an API key', desc: 'Go to API Keys → click Create Key. Copy the key — it\'s shown once.' },
                { step: '2', title: 'Install the SDK', desc: 'npm install "https://gitpkg.now.sh/jijojohny/holomem/packages/sdk-ts?main"' },
                { step: '3', title: 'Write your first memory', desc: 'See the example below.' },
              ].map((s) => (
                <div key={s.step} className="flex gap-4 items-start p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-[11px] font-black text-violet-300" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)' }}>
                    {s.step}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-white mb-0.5">{s.title}</p>
                    <p className="text-[12px] text-zinc-500">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <CodeBlock lang="ts" label="First memory write" code={`
import { HoloMem } from '@holomem/sdk';

const mem = new HoloMem({
  apiKey: 'hm_live_your_key_here',
});

// Write an encrypted memory
const entityKey = await mem.write(
  'my-research-session',
  'The correlation between X and Y is significant at p < 0.01',
  { ttl: 'episodic' }
);

console.log('Memory stored:', entityKey);

// Recall all memories from the session
const memories = await mem.recall('my-research-session');
memories.forEach((m) => console.log(m.plaintext));
`} />
          </Section>

          {/* ── Installation ────────────────────────────────────────── */}
          <Section id="install" title="Installation">
            <CodeBlock lang="bash" code={`
npm install "https://gitpkg.now.sh/jijojohny/holomem/packages/sdk-ts?main"
`} />
            <p className="text-[13px] text-zinc-400 leading-relaxed">
              Requires Node.js 18+ or any modern browser environment. The SDK is ESM-first.
            </p>
            <Callout type="tip">
              If you use TypeScript, all methods are fully typed. No <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">@types</code> package needed — types are bundled.
            </Callout>
          </Section>

          {/* ── Initialization ──────────────────────────────────────── */}
          <Section id="init" title="Initialization" subtitle="Create a HoloMem instance once and reuse it across your agent.">
            <CodeBlock lang="ts" code={`
import { HoloMem } from '@holomem/sdk';

const mem = new HoloMem({
  apiKey: process.env.HOLOMEM_API_KEY,
  encryptionKey: process.env.HOLOMEM_ENCRYPTION_KEY, // optional but recommended
});
`} />

            <div className="rounded-xl overflow-hidden my-4" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="grid px-4 py-2" style={{ gridTemplateColumns: '140px 130px 1fr', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                {['Option', 'Type', 'Description'].map((h) => (
                  <p key={h} className="text-[9px] font-bold tracking-[0.16em] uppercase text-zinc-600">{h}</p>
                ))}
              </div>
              {[
                { name: 'apiKey', type: 'string', req: true, desc: 'Your HoloMem API key (hm_live_… or hm_test_…).' },
                { name: 'encryptionKey', type: 'string', req: false, desc: 'Hex-encoded 32-byte private key. If omitted, an ephemeral key is generated — memories cannot be recalled after process restart.' },
                { name: 'baseUrl', type: 'string', req: false, desc: 'Override the API base URL. Defaults to https://holomem-production.up.railway.app.' },
              ].map((p, i, arr) => (
                <div key={p.name} className="grid items-start px-4 py-3 gap-2" style={{ gridTemplateColumns: '140px 130px 1fr', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div className="flex items-center gap-1.5">
                    <code className="text-[11px] font-mono text-violet-300">{p.name}</code>
                    {p.req && <span className="text-[8px] font-black tracking-wide text-red-400">REQ</span>}
                  </div>
                  <code className="text-[11px] font-mono text-sky-400">{p.type}</code>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>

            <Callout type="warn">
              Store your <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">encryptionKey</code> in an environment variable, not in source code. Anyone with this key can decrypt your agent's memories.
            </Callout>
          </Section>

          {/* ── write() ─────────────────────────────────────────────── */}
          <Section id="write" title="SDK Reference">
            <Method
              signature="mem.write(sessionId, plaintext, opts?)"
              description="Encrypts plaintext client-side and writes it to the memory mesh. Returns the entity key for later retrieval."
              params={[
                { name: 'sessionId', type: 'string', desc: 'Groups memories belonging to the same agent run or conversation thread.' },
                { name: 'plaintext', type: 'string', desc: 'The raw text to encrypt and store. Never leaves your machine unencrypted.' },
                { name: 'opts.ttl', type: "'working' | 'episodic' | 'persistent'", desc: "Memory tier controlling expiry. Defaults to 'episodic'." },
                { name: 'opts.agentId', type: 'string', desc: 'Tag the memory with a specific agent identifier. Useful for multi-agent systems.' },
              ]}
              returns="Promise<string> — the entity key"
            >
              <CodeBlock lang="ts" code={`
const key = await mem.write(
  'session-abc',
  'Hypothesis: model performance degrades after 48h of inactivity.',
  { ttl: 'persistent', agentId: 'analyst-01' }
);
`} />
            </Method>

            {/* ── recall() ────────────────────────────────────────────── */}
            <div id="recall" className="scroll-mt-8">
              <Method
                signature="mem.recall(sessionId, opts?)"
                description="Fetches and decrypts all active memories for a session. Use this to restore context at the start of an agent run."
                params={[
                  { name: 'sessionId', type: 'string', desc: 'The session whose memories to retrieve.' },
                  { name: 'opts.limit', type: 'number', desc: 'Maximum memories to return. Defaults to 20, max 50.' },
                ]}
                returns="Promise<Memory[]> — array of { entityKey, agentId, plaintext }"
              >
                <CodeBlock lang="ts" code={`
const memories = await mem.recall('session-abc');

// Reconstruct context for your LLM
const context = memories.map((m) => m.plaintext).join('\n');

// Example with OpenAI
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'Prior context:\n' + context },
    { role: 'user', content: userMessage },
  ],
});
`} />
              </Method>
            </div>

            {/* ── read() ──────────────────────────────────────────────── */}
            <div id="read" className="scroll-mt-8">
              <Method
                signature="mem.read(entityKey)"
                description="Fetches and decrypts a single memory node by its entity key. Returns null if the memory has expired or been deleted."
                params={[
                  { name: 'entityKey', type: 'string', desc: 'The key returned by write().' },
                ]}
                returns="Promise<string | null>"
              >
                <CodeBlock lang="ts" code={`
const plaintext = await mem.read('ent_7f3a9c...');
if (plaintext === null) {
  console.log('Memory expired or not found');
}
`} />
              </Method>
            </div>

            {/* ── delete() ────────────────────────────────────────────── */}
            <div id="delete" className="scroll-mt-8">
              <Method
                signature="mem.delete(entityKey)"
                description="Soft-deletes a memory from the index immediately. The on-chain data expires automatically via TTL regardless."
                params={[
                  { name: 'entityKey', type: 'string', desc: 'The key returned by write().' },
                ]}
                returns="Promise<void>"
              >
                <CodeBlock lang="ts" code={`
await mem.delete('ent_7f3a9c...');
`} />
              </Method>
            </div>

            {/* ── writeMany() ─────────────────────────────────────────── */}
            {/* ── link() */}
            <div id="link" className="scroll-mt-8">
              <Method
                signature="mem.link(parentKey, childKey, edgeType?)"
                description="Creates a relationship-edge entity on Arkiv linking two memory nodes. This is HoloMem's second on-chain entity type — use it to model reasoning chains, delegation, or causal relationships between memories."
                params={[
                  { name: 'parentKey', type: 'string', desc: 'Entity key of the source memory node (returned by write()).' },
                  { name: 'childKey', type: 'string', desc: 'Entity key of the target memory node.' },
                  { name: 'edgeType', type: 'string', desc: "Label for this edge. Defaults to 'linked'. Descriptive values: 'reasoning-step', 'delegation', 'causes', 'refines'." },
                ]}
                returns="Promise<{ entityKey: string; txHash: string; edgeType: string }>"
              >
                <CodeBlock lang="ts" code={`
// Connect planner output → executor findings as reasoning steps
const planKey  = await mem.write('session-abc', 'Research plan: 4 steps', { agentId: 'planner' });
const result1  = await mem.write('session-abc', 'Step 1 finding...', { agentId: 'executor-1' });
const result2  = await mem.write('session-abc', 'Step 2 finding...', { agentId: 'executor-2' });

await mem.link(planKey, result1, 'reasoning-step');
await mem.link(planKey, result2, 'reasoning-step');

// Each call writes a relationship-edge entity to Arkiv
const { edges } = await mem.getGraph('session-abc');
console.log(\`\${edges.length} relationship-edge entities on-chain\`);
`} />
                <Callout type="tip">
                  Each <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">link()</code> writes a standalone <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">relationship-edge</code> entity with <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">$creator</code> attribution and its own entity key — independently verifiable at <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">explorer.braga.hoodi.arkiv.network</code>.
                </Callout>
              </Method>
            </div>

            {/* ── getGraph() */}
            <div id="getGraph" className="scroll-mt-8">
              <Method
                signature="mem.getGraph(sessionId)"
                description="Returns the complete on-chain memory graph for a session: the agent-session root entity, all memory-node entities, and all relationship-edge entities. All three are fetched from Arkiv via PROJECT_ATTRIBUTE-filtered queries."
                params={[
                  { name: 'sessionId', type: 'string', desc: 'Session whose full entity graph to retrieve.' },
                ]}
                returns="Promise<GraphData> — { session, nodes[], edges[], meta }"
              >
                <CodeBlock lang="ts" code={`
const graph = await mem.getGraph('session-abc');

// Three distinct Arkiv entity types
console.log('agent-session:', graph.session?.entity_key);
console.log('memory-nodes:', graph.nodes.length);
console.log('relationship-edges:', graph.edges.length);
console.log('Total on-chain entities:', graph.meta.total);

// Explorer links for each entity
for (const node of graph.nodes) {
  const url = \`https://explorer.braga.hoodi.arkiv.network/entity/\${node.entity_key}\`;
  console.log(node.agent_id, '->', url);
}

// Creator wallet address (immutable $creator from Arkiv)
for (const node of graph.nodes) {
  console.log('Written by:', node.creator ?? 'unknown');
}
`} />
              </Method>
            </div>

            <div id="write-many" className="scroll-mt-8">
              <Method
                signature="mem.writeMany(sessionId, texts[], opts?)"
                description="Encrypts and writes multiple memories to a session in parallel. Returns an array of entity keys in the same order as the input texts."
                params={[
                  { name: 'sessionId', type: 'string', desc: 'Session to write all memories into.' },
                  { name: 'texts', type: 'string[]', desc: 'Array of plaintext strings to encrypt and store.' },
                  { name: 'opts.ttl', type: "'working' | 'episodic' | 'persistent'", desc: "Applied to all writes. Defaults to 'episodic'." },
                  { name: 'opts.agentId', type: 'string', desc: 'Tag all memories with this agent identifier.' },
                ]}
                returns="Promise<string[]> — array of entity keys"
              >
                <CodeBlock lang="ts" code={`
const keys = await mem.writeMany('session-abc', [
  'User prefers metric units',
  'Task requires web search',
  'Previous attempt failed at step 3',
], { ttl: 'episodic', agentId: 'planner' });

console.log(\`Stored \${keys.length} memories\`);
`} />
              </Method>
            </div>

            {/* ── listMemories() ──────────────────────────────────────── */}
            <div id="list-memories" className="scroll-mt-8">
              <Method
                signature="mem.listMemories(opts?)"
                description="Returns memory metadata (no decryption) for the authenticated key. Useful for dashboards, audits, or building custom recall logic."
                params={[
                  { name: 'opts.sessionId', type: 'string', desc: 'Filter to a specific session.' },
                  { name: 'opts.agentId', type: 'string', desc: 'Filter to memories written by a specific agent.' },
                  { name: 'opts.limit', type: 'number', desc: 'Max results to return. Defaults to 100.' },
                ]}
                returns="Promise<MemoryIndexEntry[]> — array of { entityKey, sessionId, agentId, ttlTier, createdAt, expiresAt, pinned }"
              >
                <CodeBlock lang="ts" code={`
// List all memories for agent "analyst"
const entries = await mem.listMemories({ agentId: 'analyst' });

entries.forEach((e) => {
  console.log(e.entityKey, e.ttlTier, e.pinned ? '📌' : '');
});
`} />
              </Method>
            </div>

            {/* ── listSessions() ──────────────────────────────────────── */}
            <div id="list-sessions" className="scroll-mt-8">
              <Method
                signature="mem.listSessions()"
                description="Returns a list of all active sessions for the authenticated key, with memory counts and last activity timestamps. Sessions are ordered newest first."
                returns="Promise<SessionEntry[]> — array of { sessionId, memoryCount, lastActivity }"
              >
                <CodeBlock lang="ts" code={`
const sessions = await mem.listSessions();

sessions.forEach((s) => {
  console.log(s.sessionId, s.memoryCount, 'memories');
});
`} />
              </Method>
            </div>

            {/* ── deleteSession() ─────────────────────────────────────── */}
            <div id="delete-session" className="scroll-mt-8">
              <Method
                signature="mem.deleteSession(sessionId)"
                description="Bulk soft-deletes all memories in a session. Returns the count of deleted memories. Useful for cleanup after an agent run completes."
                params={[
                  { name: 'sessionId', type: 'string', desc: 'The session to wipe.' },
                ]}
                returns="Promise<number> — count of deleted memories"
              >
                <CodeBlock lang="ts" code={`
const count = await mem.deleteSession('session-abc');
console.log(\`Deleted \${count} memories\`);
`} />
              </Method>
            </div>

            {/* ── pin() / unpin() ─────────────────────────────────────── */}
            <div id="pin" className="scroll-mt-8">
              <Method
                signature="mem.pin(entityKey) / mem.unpin(entityKey)"
                description="Pins a memory to prevent TTL expiry, or unpins it to restore normal TTL behaviour. Pinned memories remain visible across all queries regardless of their original expiry time."
                params={[
                  { name: 'entityKey', type: 'string', desc: 'The entity key returned by write().' },
                ]}
                returns="Promise<void>"
              >
                <CodeBlock lang="ts" code={`
// Pin an important finding permanently
const key = await mem.write('session-abc', 'Critical: service X has a race condition', { ttl: 'working' });
await mem.pin(key);   // survives beyond the 15-minute working TTL

// Later, unpin when no longer needed
await mem.unpin(key);
`} />
                <Callout type="tip">
                  Pin memories created as <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">working</code> tier that turn out to be important — promotes them to persistent without re-writing.
                </Callout>
              </Method>
            </div>

            {/* ── search() ────────────────────────────────────────────── */}
            <div id="search" className="scroll-mt-8">
              <Method
                signature="mem.search(queryText, opts?)"
                description="Find memories by semantic similarity. Embeds the query client-side using your embed callback, then calls POST /v1/memories/search. Requires embed= to be set in the constructor."
                params={[
                  { name: 'queryText', type: 'string', desc: 'Natural-language query to embed and compare against stored embeddings.' },
                  { name: 'opts.sessionId', type: 'string?', desc: 'Restrict search to a specific session.' },
                  { name: 'opts.agentId', type: 'string?', desc: 'Restrict search to a specific agent.' },
                  { name: 'opts.limit', type: 'number?', desc: 'Max results to return (default 10, max 50).' },
                  { name: 'opts.threshold', type: 'number?', desc: 'Minimum cosine similarity score 0–1 (default 0.7).' },
                ]}
                returns="Promise<SearchResult[]>"
              >
                <CodeBlock lang="ts" code={`
import { HoloMem } from '@holomem/sdk';
import OpenAI from 'openai';

const openai = new OpenAI();

const mem = new HoloMem({
  apiKey: process.env.HOLOMEM_API_KEY!,
  encryptionKey: process.env.HOLOMEM_ENC_KEY,
  // Embedding is computed client-side — server never sees plaintext
  embed: async (text) => {
    const res = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return res.data[0].embedding;
  },
});

// Write memories — embedding is auto-computed and stored
await mem.write('my-session', 'User prefers dark mode');
await mem.write('my-session', 'User is located in Tokyo');

// Search by semantic similarity
const results = await mem.search('What are the user preferences?', {
  sessionId: 'my-session',
  threshold: 0.75,
});

for (const r of results) {
  console.log(\`[\${r.score.toFixed(3)}] \${r.plaintext}\`);
}
`} />
                <Callout type="info">
                  The <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">embed</code> callback runs entirely in your process — HoloMem never sees the plaintext or the embedding. The embedding is stored alongside the encrypted ciphertext in the index.
                </Callout>
              </Method>
            </div>

            {/* ── usage() ─────────────────────────────────────────────── */}
            <div id="usage-method" className="scroll-mt-8">
              <Method
                signature="mem.usage()"
                description="Returns current quota usage for your API key — writes consumed, reads this month, and active memory count."
                returns="Promise<UsageResponse>"
              >
                <CodeBlock lang="ts" code={`
const stats = await mem.usage();
console.log(\`\${stats.writes.used} / \${stats.writes.limit} writes used this month\`);
console.log(\`\${stats.memories.active} active memory nodes\`);
`} />
              </Method>
            </div>
          </Section>

          {/* ── Memory Tiers ────────────────────────────────────────── */}
          <Section id="tiers" title="Memory Tiers" subtitle="Choose TTL based on how long the information needs to survive.">
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="grid px-5 py-2.5" style={{ gridTemplateColumns: '120px 80px 1fr', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                {['Tier', 'Expires', 'Best for'].map((h) => (
                  <p key={h} className="text-[9px] font-bold tracking-[0.16em] uppercase text-zinc-600">{h}</p>
                ))}
              </div>
              {[
                {
                  name: 'working',
                  color: '#fbbf24',
                  bg: 'rgba(251,191,36,0.1)',
                  border: 'rgba(251,191,36,0.2)',
                  ttl: '15 min',
                  use: 'Intermediate steps, draft outputs, tool call scratch space. Auto-purged after the task completes.',
                },
                {
                  name: 'episodic',
                  color: '#38bdf8',
                  bg: 'rgba(56,189,248,0.1)',
                  border: 'rgba(56,189,248,0.2)',
                  ttl: '1 hour',
                  use: 'Conversation context, session findings, short-term agent state. Default tier.',
                },
                {
                  name: 'persistent',
                  color: '#34d399',
                  bg: 'rgba(52,211,153,0.1)',
                  border: 'rgba(52,211,153,0.2)',
                  ttl: '30 days',
                  use: 'Consolidated reports, cross-session user preferences, long-term knowledge.',
                },
              ].map((t, i, arr) => (
                <div key={t.name} className="grid items-start px-5 py-4 gap-4" style={{ gridTemplateColumns: '120px 80px 1fr', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-[0.1em] w-fit" style={{ background: t.bg, border: `1px solid ${t.border}`, color: t.color }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />
                    {t.name}
                  </span>
                  <span className="text-[12px] font-mono text-zinc-400">{t.ttl}</span>
                  <p className="text-[12px] text-zinc-500 leading-relaxed">{t.use}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Arkiv Entity Model ──────────────────────────────────── */}
          <Section id="entity-model" title="Arkiv Entity Model" subtitle="HoloMem uses three distinct on-chain entity types, all tagged with PROJECT_ATTRIBUTE = HOLOMEM_SYSTEM_PROD.">
            <p className="text-[13px] text-zinc-400 leading-relaxed mb-5">
              Every entity written to Arkiv carries a shared <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">project</code> attribute that scopes all queries, plus a <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">type</code> attribute that distinguishes entity roles.{' '}
              Arkiv's immutable <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">$creator</code> field records the wallet that wrote each entity — tamper-proof attribution enforced by the L3 chain.
            </p>

            {/* Entity type cards */}
            <div className="space-y-4 mb-6">
              {[
                {
                  type: 'agent-session',
                  color: '#a78bfa',
                  bg: 'rgba(124,58,237,0.08)',
                  border: 'rgba(167,139,250,0.2)',
                  shape: '⬡',
                  ttl: 'persistent (30d)',
                  desc: 'Root entity created on the first memory write to a new session. Anchors the session graph and carries session-level metadata.',
                  attrs: ['project=HOLOMEM_SYSTEM_PROD', 'type=agent-session', 'sessionId=<session>', 'agentId=<agent>'],
                },
                {
                  type: 'memory-node',
                  color: '#34d399',
                  bg: 'rgba(52,211,153,0.08)',
                  border: 'rgba(52,211,153,0.2)',
                  shape: '●',
                  ttl: 'working (15m) · episodic (1h) · persistent (30d)',
                  desc: 'Core memory entity. Payload is ECIES-encrypted ciphertext — the Arkiv ledger never sees raw content. TTL controls auto-pruning.',
                  attrs: ['project=HOLOMEM_SYSTEM_PROD', 'type=memory-node', 'sessionId=<session>', 'agentId=<agent>'],
                },
                {
                  type: 'relationship-edge',
                  color: '#38bdf8',
                  bg: 'rgba(56,189,248,0.08)',
                  border: 'rgba(56,189,248,0.2)',
                  shape: '◇',
                  ttl: 'episodic (1h)',
                  desc: 'Directed link between two memory nodes. Models reasoning chains, delegation, causality. Queried by parentKey to traverse the graph.',
                  attrs: ['project=HOLOMEM_SYSTEM_PROD', 'type=relationship-edge', 'parentKey=<entity-key>', 'childKey=<entity-key>', 'edgeType=<label>', 'sessionId=<session>'],
                },
              ].map((e) => (
                <div key={e.type} className="rounded-xl p-4" style={{ background: e.bg, border: `1px solid ${e.border}` }}>
                  <div className="flex items-start gap-3">
                    <span className="text-[20px] mt-0.5 shrink-0" style={{ color: e.color }}>{e.shape}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-[13px] font-mono font-bold" style={{ color: e.color }}>{e.type}</code>
                        <span className="text-[9px] font-bold tracking-[0.12em] text-zinc-600 uppercase">TTL: {e.ttl}</span>
                      </div>
                      <p className="text-[12px] text-zinc-400 leading-relaxed mb-2">{e.desc}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {e.attrs.map((a) => (
                          <code key={a} className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.3)', color: 'rgba(212,212,216,0.6)' }}>{a}</code>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Callout type="info">
              All three entity types are queried via <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">buildQuery().where(and([eq('project', 'HOLOMEM_SYSTEM_PROD'), eq('type', '...')]))</code> — the PROJECT_ATTRIBUTE ensures namespace isolation across the shared Arkiv L3 chain.
            </Callout>

            <CodeBlock lang="ts" code={`
// Three Arkiv entity types in one session graph
// All filtered by: project = HOLOMEM_SYSTEM_PROD

// 1. agent-session  — written automatically on first mem.write()
// 2. memory-node    — written by mem.write()
// 3. relationship-edge — written by mem.link()

const key1 = await mem.write('session-001', 'Agent context loaded', { agentId: 'planner' });
const key2 = await mem.write('session-001', 'Tool call result: success', { agentId: 'executor' });
await mem.link(key1, key2, 'delegation');  // → writes relationship-edge entity

const graph = await mem.getGraph('session-001');
// graph.session  → 1 agent-session entity  (type: agent-session)
// graph.nodes    → 2 memory-node entities  (type: memory-node)
// graph.edges    → 1 edge entity           (type: relationship-edge)
// graph.meta.entity_types → ['agent-session', 'memory-node', 'relationship-edge']
`} />
          </Section>

          {/* ── Semantic Search ─────────────────────────────────────── */}
          <Section id="semantic" title="Semantic Search" subtitle="Find memories by meaning, not just session. Embeddings stay in your process — the server never sees plaintext.">
            <p className="text-[13px] text-zinc-400 leading-relaxed mb-4">
              Pass an <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">embed</code> callback to the constructor. Every <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">write()</code> will auto-embed the plaintext client-side before encrypting. <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">search()</code> embeds the query the same way and runs a vector cosine similarity scan on Postgres via pgvector.
            </p>
            <Callout type="info">
              The embed function runs in your process <strong className="text-white font-semibold">before</strong> encryption. The vector stored on the server is a fingerprint of the ciphertext — not the plaintext — preserving the zero-knowledge guarantee.
            </Callout>
            <p className="text-[13px] font-semibold text-white mb-2">Python example (openai embeddings):</p>
            <CodeBlock lang="ts" label="Python" code={`
from holomem import HoloMem
from openai import OpenAI

oai = OpenAI()

def embed(text: str) -> list[float]:
    return oai.embeddings.create(
        model="text-embedding-3-small", input=text
    ).data[0].embedding

mem = HoloMem(
    api_key="hm_live_xxx",
    encryption_key="your-hex-key",
    embed=embed,
)

mem.write("session-001", "User prefers concise bullet-point answers")
mem.write("session-001", "User is a senior backend engineer")

results = mem.search("What communication style does the user prefer?",
                     session_id="session-001", threshold=0.75)

for r in results:
    print(f"[{r.score:.3f}] {r.plaintext}")
`} />
          </Section>

          {/* ── Framework Adapters ──────────────────────────────────── */}
          <Section id="adapters" title="Framework Adapters" subtitle="Drop HoloMem into LangGraph, CrewAI, or AutoGen with zero glue code.">
            <p className="text-[13px] font-semibold text-white mb-2">LangGraph BaseStore</p>
            <p className="text-[13px] text-zinc-400 leading-relaxed mb-3">
              <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">HoloMemStore</code> implements LangGraph's <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">BaseStore</code> interface — pass it directly to <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">StateGraph.compile(store=...)</code>. Namespace tuples map to session IDs joined by <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">/</code>.
            </p>
            <CodeBlock lang="ts" label="Python — LangGraph" code={`
from holomem.langgraph import HoloMemStore
from langgraph.graph import StateGraph

store = HoloMemStore(
    api_key="hm_live_xxx",
    encryption_key="your-hex-key",
)

# All memory ops in your graph are now encrypted + on-chain
graph = builder.compile(store=store)
result = await graph.ainvoke(inputs, config={"configurable": {"thread_id": "run-001"}})
`} />

            <p className="text-[13px] font-semibold text-white mb-2 mt-6">LangChain / CrewAI Tools</p>
            <p className="text-[13px] text-zinc-400 leading-relaxed mb-3">
              <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">HoloMemToolkit</code> wraps write, recall, and delete as LangChain <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">Tool</code> objects compatible with CrewAI and AutoGen.
            </p>
            <CodeBlock lang="ts" label="Python — CrewAI" code={`
from holomem.tools import HoloMemToolkit
from crewai import Agent

toolkit = HoloMemToolkit(
    session_id="crew-run-001",
    api_key="hm_live_xxx",
    encryption_key="your-hex-key",
    agent_id="research-agent",
)

researcher = Agent(
    role="Research Analyst",
    tools=toolkit.as_langchain_tools(),
    ...
)
`} />
            <Callout type="tip">
              For AutoGen, use <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">toolkit.as_autogen_tools()</code> instead — it returns the OpenAI function-calling schema with callable entries AutoGen can register directly.
            </Callout>
          </Section>

          {/* ── Teams ───────────────────────────────────────────────── */}
          <Section id="teams" title="Teams" subtitle="Share encrypted memory quota across multiple API keys in your organization.">
            <p className="text-[13px] text-zinc-400 leading-relaxed mb-4">
              Create a team to pool the write quota across all member keys. Each key still encrypts independently — there is no shared keyring. The team tier unlocks 500,000 writes/month pooled across all members.
            </p>
            <CodeBlock lang="http" code={`
# Create a team
POST /v1/teams
{ "name": "acme-agents" }

# Add a member by customer_id
POST /v1/teams/:id/members
{ "customer_id": "cust_xxx", "role": "member" }

# List your teams
GET /v1/teams

# List members
GET /v1/teams/:id/members
`} />
            <Callout type="info">
              Teams are managed in the <strong className="text-white font-semibold">Teams</strong> tab of the dashboard. The team owner can add or remove members at any time. Removing a member does not delete their memories.
            </Callout>
          </Section>

          {/* ── Encryption Keys ─────────────────────────────────────── */}
          <Section id="encryption" title="Encryption Keys" subtitle="HoloMem encrypts all data client-side before any network call.">
            <p className="text-[13px] text-zinc-400 leading-relaxed mb-4">
              Every write is encrypted with ECIES (secp256k1) using your <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">encryptionKey</code> before leaving your machine. The API server never sees plaintext.
            </p>

            <p className="text-[13px] font-semibold text-white mb-2">Generate a key once and save it:</p>
            <CodeBlock lang="bash" code={`
# Generate a random 32-byte hex key and save to .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# → paste the output into HOLOMEM_ENCRYPTION_KEY in your .env
`} />

            <p className="text-[13px] font-semibold text-white mb-2">Load from file (recommended for long-running agents):</p>
            <CodeBlock lang="ts" code={`
// Write the key to a file on first run
const mem = new HoloMem({ apiKey: process.env.HOLOMEM_API_KEY });
mem.saveKey('./agent.key');   // saved with chmod 600

// On subsequent runs, load from file
const mem = HoloMem.loadKey('./agent.key', {
  apiKey: process.env.HOLOMEM_API_KEY,
});
`} />
            <Callout type="warn">
              If you lose your <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">encryptionKey</code>, existing memories are unrecoverable — there is no server-side key escrow. Back it up in a secrets manager.
            </Callout>
          </Section>

          {/* ── REST API ────────────────────────────────────────────── */}
          <Section id="rest" title="REST API" subtitle="Use the HTTP API directly if you're not using the TypeScript SDK.">
            <p className="text-[13px] text-zinc-400 leading-relaxed mb-4">
              All requests require <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">Authorization: Bearer &lt;api_key&gt;</code>. The base URL is <code className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded">https://holomem-production.up.railway.app</code>.
            </p>

            <p className="text-[13px] font-semibold text-white mb-1">Write a memory</p>
            <CodeBlock lang="http" code={`
POST /v1/memories
Authorization: Bearer hm_live_your_key
Content-Type: application/json

{
  "session_id": "my-session",
  "ciphertext": "<ecies_encrypted_hex>",
  "ttl_tier": "episodic",
  "agent_id": "agent-01"
}

// Response 201
{
  "entity_key": "ent_7f3a9c...",
  "tx_hash": "0xabcd...",
  "expires_at": "2026-05-22T14:30:00Z"
}
`} />

            <p className="text-[13px] font-semibold text-white mb-1">Recall all session memories</p>
            <CodeBlock lang="http" code={`
POST /v1/memories/recall
Authorization: Bearer hm_live_your_key
Content-Type: application/json

{ "session_id": "my-session", "limit": 20 }

// Response 200
{
  "session_id": "my-session",
  "memories": [
    { "entity_key": "ent_7f3a9c...", "agent_id": "agent-01", "ciphertext": "..." }
  ]
}
`} />

            <p className="text-[13px] font-semibold text-white mb-1">Delete a memory</p>
            <CodeBlock lang="http" code={`
DELETE /v1/memories/ent_7f3a9c...
Authorization: Bearer hm_live_your_key

// Response 204 No Content
`} />

            <p className="text-[13px] font-semibold text-white mb-1">Check usage</p>
            <CodeBlock lang="http" code={`
GET /v1/usage
Authorization: Bearer hm_live_your_key

// Response 200
{
  "tier": "pro",
  "writes": { "used": 1042, "limit": 50000, "remaining": 48958, "resets_at": "2026-06-01T00:00:00Z" },
  "reads": { "this_month": 3210 },
  "memories": { "active": 87 }
}
`} />

            <p className="text-[13px] font-semibold text-white mb-1">Create a relationship-edge entity</p>
            <CodeBlock lang="http" code={`
POST /v1/memories/:parentKey/link
Authorization: Bearer hm_live_your_key
Content-Type: application/json

{
  "child_key": "0xabc123...",
  "edge_type": "reasoning-step"
}

// Response 201
{
  "entity_key": "0xedge...",
  "tx_hash": "0xabc...",
  "edge_type": "reasoning-step",
  "parent_key": "0xparent...",
  "child_key": "0xabc123..."
}
`} />

            <p className="text-[13px] font-semibold text-white mb-1">Fetch full session graph (all 3 entity types)</p>
            <CodeBlock lang="http" code={`
GET /v1/sessions/:id/graph
Authorization: Bearer hm_live_your_key

// Response 200
{
  "session": {
    "entity_key": "0xsession...", "session_id": "my-session",
    "agent_id": "planner", "creator": "0xwallet...", "type": "agent-session"
  },
  "nodes": [
    { "entity_key": "0xnode1...", "agent_id": "executor-1", "creator": "0xwallet...", "type": "memory-node" }
  ],
  "edges": [
    { "entity_key": "0xedge1...", "parent_key": "0xnode1...", "child_key": "0xnode2...",
      "edge_type": "delegation", "type": "relationship-edge" }
  ],
  "meta": {
    "project_attribute": "HOLOMEM_SYSTEM_PROD",
    "entity_types": ["agent-session", "memory-node", "relationship-edge"],
    "total": 5
  }
}
`} />

            <p className="text-[13px] font-semibold text-white mb-1">Explicitly create a session entity</p>
            <CodeBlock lang="http" code={`
POST /v1/sessions
Authorization: Bearer hm_live_your_key
Content-Type: application/json

{ "session_id": "my-session", "agent_id": "planner" }

// Response 201
{ "entity_key": "0xsession...", "tx_hash": "0xabc...", "session_id": "my-session", "created": true }
`} />
          </Section>

          {/* ── Webhooks ────────────────────────────────────────────── */}
          <Section id="webhooks" title="Webhooks" subtitle="Get notified in real time when your agents write, read, or delete memories.">
            <p className="text-[13px] text-zinc-400 leading-relaxed mb-4">
              Register an endpoint in <strong className="text-white font-semibold">Security Logs</strong> in the dashboard. HoloMem will POST a JSON payload to your URL whenever a subscribed event occurs.
            </p>

            <p className="text-[13px] font-semibold text-white mb-1">Example payload (write event)</p>
            <CodeBlock lang="ts" label="JSON Payload" code={`
{
  "event": "write",
  "entity_key": "ent_7f3a9c...",
  "session_id": "my-session",
  "agent_id": "agent-01",
  "ttl_tier": "episodic",
  "timestamp": "2026-05-22T10:41:00Z"
}
`} />

            <p className="text-[13px] font-semibold text-white mb-1">Verify the signature</p>
            <CodeBlock lang="ts" code={`
import { createHmac } from 'crypto';

function verifyHoloMemSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return expected === signature;
}

// In your webhook handler (Express example):
app.post('/webhook', (req, res) => {
  const sig = req.headers['x-holomem-signature'];
  const raw = JSON.stringify(req.body);

  if (!verifyHoloMemSignature(raw, sig, process.env.HOLOMEM_WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  // Process the event
  console.log('Event received:', req.body.event);
  res.status(200).send('ok');
});
`} />

            <Callout type="info">
              Your endpoint must respond with HTTP 2xx within 10 seconds. Failed deliveries are visible in the Security Logs tab — you can replay them from there.
            </Callout>
          </Section>

          <div className="h-16" aria-hidden="true" />
        </main>
      </div>
    </DashboardShell>
  );
}
