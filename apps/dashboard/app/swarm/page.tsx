'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import DashboardShell from '../../components/DashboardShell';

/* ─── Types ─────────────────────────────────────────────────────────────── */
type NodeStatus = 'idle' | 'thinking' | 'done';

interface AgentNode {
  id: string;
  label: string;
  role: 'planner' | 'executor' | 'consolidator';
  color: string;
  bg: string;
  border: string;
  cx: number;
  cy: number;
  r: number;
}

interface LogEntry {
  id: string;
  time: string;
  text: string;
  color: string;
}

/* ─── Layout constants ───────────────────────────────────────────────────── */
const SVG_W = 700;
const SVG_H = 340;

const NODES: AgentNode[] = [
  {
    id: 'planner',
    label: 'Planner',
    role: 'planner',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.15)',
    border: 'rgba(167,139,250,0.5)',
    cx: SVG_W / 2,
    cy: 60,
    r: 32,
  },
  {
    id: 'exec-0',
    label: 'Executor A',
    role: 'executor',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.12)',
    border: 'rgba(52,211,153,0.45)',
    cx: SVG_W * 0.15,
    cy: 190,
    r: 26,
  },
  {
    id: 'exec-1',
    label: 'Executor B',
    role: 'executor',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.12)',
    border: 'rgba(52,211,153,0.45)',
    cx: SVG_W * 0.37,
    cy: 190,
    r: 26,
  },
  {
    id: 'exec-2',
    label: 'Executor C',
    role: 'executor',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.12)',
    border: 'rgba(52,211,153,0.45)',
    cx: SVG_W * 0.63,
    cy: 190,
    r: 26,
  },
  {
    id: 'exec-3',
    label: 'Executor D',
    role: 'executor',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.12)',
    border: 'rgba(52,211,153,0.45)',
    cx: SVG_W * 0.85,
    cy: 190,
    r: 26,
  },
  {
    id: 'consolidator',
    label: 'Consolidator',
    role: 'consolidator',
    color: '#2dd4bf',
    bg: 'rgba(45,212,191,0.12)',
    border: 'rgba(45,212,191,0.45)',
    cx: SVG_W / 2,
    cy: 300,
    r: 32,
  },
];

/* edges: which pairs are connected */
const EDGE_PAIRS: [string, string][] = [
  ['planner', 'exec-0'],
  ['planner', 'exec-1'],
  ['planner', 'exec-2'],
  ['planner', 'exec-3'],
  ['exec-0', 'consolidator'],
  ['exec-1', 'consolidator'],
  ['exec-2', 'consolidator'],
  ['exec-3', 'consolidator'],
];

function now(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

let logCounter = 0;
function mkLog(text: string, color = 'rgba(161,161,170,0.8)'): LogEntry {
  return { id: String(logCounter++), time: now(), text, color };
}

const MOCK_ENTITY_KEYS = [
  '0x7f3a91c2d…4b8e',
  '0x1e09cc37b…9a22',
  '0xb23fd84ae…11cc',
  '0x5509a0ff1…873d',
];

/* ─── Node SVG component ─────────────────────────────────────────────────── */
function AgentNodeShape({ node, status }: { node: AgentNode; status: NodeStatus }) {
  const isPulse = status === 'thinking';
  const isDone = status === 'done';

  return (
    <g>
      {/* Pulse ring for thinking */}
      {isPulse && (
        <circle
          cx={node.cx}
          cy={node.cy}
          r={node.r + 10}
          fill="none"
          stroke={node.color}
          strokeWidth="1"
          opacity="0.25"
          style={{ animation: 'pulse-ring 1.2s ease-out infinite' }}
        />
      )}

      {/* Main circle */}
      <circle
        cx={node.cx}
        cy={node.cy}
        r={node.r}
        fill={node.bg}
        stroke={node.border}
        strokeWidth={status !== 'idle' ? 1.8 : 1.3}
        style={{
          filter: status !== 'idle' ? `drop-shadow(0 0 8px ${node.color}55)` : undefined,
          transition: 'stroke-width 0.3s',
        }}
      />

      {/* Role short label */}
      <text
        x={node.cx}
        y={node.cy - 4}
        textAnchor="middle"
        fill={status === 'idle' ? `${node.color}66` : node.color}
        fontSize={node.role === 'executor' ? 8 : 9}
        fontFamily="monospace"
        fontWeight="bold"
        style={{ transition: 'fill 0.3s' }}
      >
        {node.label}
      </text>

      {/* Status indicator */}
      <text
        x={node.cx}
        y={node.cy + 11}
        textAnchor="middle"
        fill={status === 'idle' ? 'rgba(113,113,122,0.5)' : node.color}
        fontSize={7}
        fontFamily="monospace"
        style={{ transition: 'fill 0.3s' }}
      >
        {isDone ? '✓ done' : isPulse ? '● thinking' : '○ idle'}
      </text>
    </g>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function SwarmPage() {
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, NodeStatus>>({});
  const [activeEdges, setActiveEdges] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  /* Scroll log to bottom whenever new entries come in */
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [...prev, entry]);
  }, []);

  function schedule(fn: () => void, ms: number) {
    timers.current.push(setTimeout(fn, ms));
  }

  function setStatus(id: string, status: NodeStatus) {
    setStatuses((prev) => ({ ...prev, [id]: status }));
  }

  function activateEdge(a: string, b: string) {
    setActiveEdges((prev) => new Set(prev).add(`${a}--${b}`));
  }

  function runSwarm() {
    if (running) return;

    /* Clear previous timers & reset state */
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setStatuses({});
    setActiveEdges(new Set());
    setLogs([]);
    setRunning(true);

    const q = prompt.trim() || 'What are the latest developments in autonomous AI agents?';

    /* ── Timeline ── */

    /* t=0: planner starts */
    schedule(() => {
      setStatus('planner', 'thinking');
      addLog(mkLog(`[planner] Decomposing query: "${q}"`, '#a78bfa'));
    }, 0);

    /* t=1.4s: planner emits sub-tasks */
    schedule(() => {
      addLog(mkLog('[planner] Identified 4 research sub-tasks', '#a78bfa'));
      addLog(mkLog('[planner] Dispatching to executor pool…', '#a78bfa'));
    }, 1400);

    /* t=2s: planner done, executors start staggered */
    schedule(() => {
      setStatus('planner', 'done');
      activateEdge('planner', 'exec-0');
      activateEdge('planner', 'exec-1');
      activateEdge('planner', 'exec-2');
      activateEdge('planner', 'exec-3');
    }, 2000);

    const execLabels = ['A', 'B', 'C', 'D'];
    const execQueries = [
      'searching: autonomous agents 2025',
      'searching: multi-agent orchestration patterns',
      'searching: LLM tool-use benchmarks',
      'searching: memory architectures for agents',
    ];

    [0, 1, 2, 3].forEach((i) => {
      schedule(() => {
        setStatus(`exec-${i}`, 'thinking');
        addLog(mkLog(`[exec-${execLabels[i]}] ${execQueries[i]}`, '#34d399'));
      }, 2200 + i * 250);
    });

    /* t=4.5s: executors finish staggered */
    [0, 1, 2, 3].forEach((i) => {
      schedule(() => {
        setStatus(`exec-${i}`, 'done');
        addLog(mkLog(`[exec-${execLabels[i]}] Retrieved ${6 + i * 3} results`, '#34d399'));
        activateEdge(`exec-${i}`, 'consolidator');
      }, 4500 + i * 300);
    });

    /* t=5.8s: consolidator starts */
    schedule(() => {
      setStatus('consolidator', 'thinking');
      addLog(mkLog('[consolidator] Merging results from 4 executors…', '#2dd4bf'));
    }, 5800);

    /* t=7s: writing to memory */
    schedule(() => {
      addLog(mkLog('[consolidator] Synthesizing final report…', '#2dd4bf'));
      addLog(mkLog('[consolidator] Writing memory nodes to Arkiv…', '#2dd4bf'));
    }, 7000);

    /* t=8.2s: consolidator done, entities written */
    schedule(() => {
      setStatus('consolidator', 'done');
      addLog(mkLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'rgba(255,255,255,0.1)'));
      addLog(mkLog('✓ Memory graph written to Arkiv testnet', '#34d399'));
      MOCK_ENTITY_KEYS.forEach((k, i) => {
        addLog(mkLog(`  entity[${i}] ${k}`, 'rgba(167,139,250,0.8)'));
      });
      addLog(mkLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'rgba(255,255,255,0.1)'));
      setRunning(false);
    }, 8200);
  }

  const nodeMap = Object.fromEntries(NODES.map((n) => [n.id, n]));

  return (
    <DashboardShell>
      {/* Inject keyframe for pulse ring */}
      <style>{`
        @keyframes pulse-ring {
          0%   { r: ${0}; opacity: 0.3; }
          100% { r: 48px; opacity: 0; }
        }
      `}</style>

      <div className="p-6 space-y-5">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-tight flex items-center gap-2.5">
            <span style={{ color: '#a78bfa' }}>⚡</span>
            Live Swarm Visualizer
          </h1>
          <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-zinc-600 mt-0.5">
            Research Agent Simulation · Arkiv Memory Testnet
          </p>
        </div>

        {/* ── Prompt input ────────────────────────────────────────── */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-zinc-600 shrink-0" aria-hidden="true">
              <path d="M2 6.5h9M6.5 2l4.5 4.5L6.5 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !running) runSwarm(); }}
              placeholder="ENTER A RESEARCH QUESTION..."
              className="flex-1 bg-transparent text-[11px] font-semibold tracking-[0.1em] text-zinc-300 placeholder-zinc-700 focus:outline-none"
              disabled={running}
              aria-label="Research question"
            />
            <button
              onClick={runSwarm}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold tracking-[0.1em] uppercase transition-all focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50"
              style={{
                background: running ? 'rgba(124,58,237,0.15)' : 'rgba(124,58,237,0.25)',
                border: '1px solid rgba(124,58,237,0.4)',
                color: '#c4b5fd',
                boxShadow: running ? 'none' : '0 0 12px rgba(124,58,237,0.2)',
              }}
            >
              {running ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="animate-spin" aria-hidden="true">
                    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="14 7"/>
                  </svg>
                  Running…
                </>
              ) : (
                <>⚡ Run Swarm</>
              )}
            </button>
          </div>
        </div>

        {/* ── SVG Visualization ───────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div
            className="flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-zinc-500">Agent Topology</p>
            <div className="flex items-center gap-4">
              {[
                { color: '#a78bfa', label: 'Planner' },
                { color: '#34d399', label: 'Executor' },
                { color: '#2dd4bf', label: 'Consolidator' },
              ].map((t) => (
                <div key={t.label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                  <span className="text-[9px] font-bold tracking-[0.1em] text-zinc-600">{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="w-full"
            style={{ height: '340px', display: 'block' }}
          >
            <defs>
              <marker id="arr-edge" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0.5 L5,3 L0,5.5 Z" fill="rgba(255,255,255,0.18)" />
              </marker>
            </defs>

            {/* Edges */}
            {EDGE_PAIRS.map(([aId, bId]) => {
              const a = nodeMap[aId];
              const b = nodeMap[bId];
              const key = `${aId}--${bId}`;
              const active = activeEdges.has(key);

              /* Offset line endpoints to circle edges */
              const dx = b.cx - a.cx;
              const dy = b.cy - a.cy;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const ux = dx / dist;
              const uy = dy / dist;
              const x1 = a.cx + ux * (a.r + 4);
              const y1 = a.cy + uy * (a.r + 4);
              const x2 = b.cx - ux * (b.r + 8);
              const y2 = b.cy - uy * (b.r + 8);

              return (
                <line
                  key={key}
                  x1={x1} y1={y1}
                  x2={x2} y2={y2}
                  stroke={active ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.07)'}
                  strokeWidth={active ? 1.5 : 1}
                  strokeDasharray={active ? 'none' : '5 3'}
                  markerEnd={active ? 'url(#arr-edge)' : undefined}
                  style={{ transition: 'stroke 0.4s, stroke-width 0.4s' }}
                />
              );
            })}

            {/* Nodes */}
            {NODES.map((node) => (
              <AgentNodeShape
                key={node.id}
                node={node}
                status={statuses[node.id] ?? 'idle'}
              />
            ))}
          </svg>
        </div>

        {/* ── Terminal log ─────────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-zinc-600 ml-2">
                Swarm Event Log
              </span>
            </div>
            {running && (
              <span
                className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.12em] uppercase"
                style={{ color: '#34d399' }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: '#34d399', boxShadow: '0 0 6px rgba(52,211,153,0.8)' }}
                />
                Live
              </span>
            )}
          </div>

          <div
            ref={logRef}
            className="px-5 py-4 font-mono text-[11px] space-y-1 overflow-y-auto"
            style={{ height: '200px', scrollBehavior: 'smooth' }}
          >
            {logs.length === 0 ? (
              <p style={{ color: 'rgba(113,113,122,0.4)' }}>
                {'>'} Waiting for swarm to start…
              </p>
            ) : (
              logs.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <span style={{ color: 'rgba(113,113,122,0.5)' }} className="shrink-0 select-none">
                    {entry.time}
                  </span>
                  <span style={{ color: entry.color }}>{entry.text}</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}
