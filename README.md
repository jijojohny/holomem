# HoloMem

**Cryptographic Memory Mesh for Autonomous Collaborative Agent Swarms**

HoloMem is an open-source, decentralized agent memory network built on [Arkiv](https://arkiv.network) — Ethereum's modular L3 data layer. It gives multi-agent AI systems a shared, **private, auto-pruning, user-owned** memory layer on-chain.

```
╔══════════════════════════════════════════════════════════════╗
║        HoloMem: Cryptographic Memory Mesh                    ║
║        Three Entity Types · Arkiv Braga Testnet              ║
╚══════════════════════════════════════════════════════════════╝
```

**Live dashboard:** [https://holomem-dashboard.vercel.app](https://holomem-dashboard.vercel.app)  
**GitHub:** [https://github.com/jijojohny/holomem](https://github.com/jijojohny/holomem)  
**Arkiv explorer:** [https://explorer.braga.hoodi.arkiv.network](https://explorer.braga.hoodi.arkiv.network)

---

## Why HoloMem?

| Problem | HoloMem Solution |
|---------|-----------------|
| Agents forget between sessions | Persistent on-chain memory with configurable TTL tiers |
| Centralized vector DBs lock your data | User-owned entities via Arkiv `$owner` field |
| Public ledgers expose raw agent logs | ECIES client-side encryption — only ciphertext hits the chain |
| L1 smart contracts too expensive for agent writes | Arkiv L3 DB-Chains with GLM-based predictable pricing |
| No native memory pruning | Time-scoped `expiresIn` auto-removes context after TTL |
| Single-agent silos | Relational `AgentSession → MemoryNode → RelationshipEdge` on-chain graph |

---

## Architecture

```
User / LLM Application
         │
         ▼
  ┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
  │   Planner   │────▶│    Executor(s)   │────▶│  Consolidator    │
  │   Agent     │     │    Agent 1-4     │     │    Agent         │
  └─────────────┘     └──────────────────┘     └──────────────────┘
         │                    │                        │
         │  (ECIES encrypt)   │  (ECIES encrypt)       │  (ECIES encrypt)
         ▼                    ▼                        ▼
  ┌─────────────────────────────────────────────────────────────┐
  │              Arkiv Braga Testnet (L3 DB-Chain)              │
  │                                                             │
  │  AgentSession [session root]  ←─ project: HOLOMEM_SYSTEM_PROD
  │  MemoryNode   [plan]          ←──── RelationshipEdge [reasoning]
  │  MemoryNode   [result]        ←──── RelationshipEdge [delegation]
  │  MemoryNode   [final]                                       │
  │                                                             │
  │  • $creator  : immutable write attribution (pool wallet)    │
  │  • $owner    : mutable control (transfer to sub-agents)     │
  │  • expiresIn : auto-prune from index after TTL              │
  └─────────────────────────────────────────────────────────────┘
         │
         ▼
  Ethereum (via Arkiv L2 coordination layer / OP Stack)
```

### Arkiv Entity Types

Every entity written by HoloMem carries `PROJECT_ATTRIBUTE = { key: 'project', value: 'HOLOMEM_SYSTEM_PROD' }`.

| Entity Type | Arkiv `type` field | TTL | Purpose |
|-------------|-------------------|-----|---------|
| `agent-session` | `agent-session` | 30 days | Session root; created automatically on first memory write |
| `memory-node` | `memory-node` | 15 min / 1 h / 30 days | Encrypted memory payload — tiered by working / episodic / persistent |
| `relationship-edge` | `relationship-edge` | 1 hour | Directed link between two memory nodes (e.g. `reasoning-step`, `task-delegation`) |

### Memory Tiers

| Tier | TTL | Use case |
|------|-----|----------|
| `working` | 15 min | Planner instructions, in-flight draft steps |
| `episodic` | 1 hour | Executor research findings per session |
| `persistent` | 30 days | Final consolidated reports, cross-session context |

---

## Demo: Research Swarm

```
◉ Planner Agent initializing research session...
✓ AgentSession created  entityKey: 0xa1b2...ef09  TTL: 30d
✓ Plan written to Arkiv  entityKey: 0xf3a2...bd91  TTL: 15min
  Research plan:
    1. Current State     — Analyze the current state of decentralized AI
    2. Key Challenges    — Identify major technical and adoption challenges
    3. Opportunities     — Map key growth vectors and use cases
    4. Future Outlook    — Project where this will be in 5 years

◉ Executor #1 researching "Current State"...
✓ MemoryNode written  entityKey: 0x4c9d...a3f2  edge: 0x8b1c...
◉ Executor #2 researching "Key Challenges"...
✓ MemoryNode written  entityKey: 0x7e1f...c810  edge: 0x2d4e...
◉ Executor #3 researching "Opportunities"...
✓ MemoryNode written  entityKey: 0x2a8b...5d04  edge: 0x6f91...
◉ Executor #4 researching "Future Outlook"...
✓ MemoryNode written  entityKey: 0x6d3c...7f19  edge: 0x3c27...

◉ Consolidator Agent synthesizing 4 research threads...
✓ Final report written  entityKey: 0x9e5a...2c88  TTL: 30d

  Memory Graph (session: a3f9d201)
  ════════════════════════════════════════════════════════════
  AgentSession          0xa1b2...ef09  ⏱ 30d  TTL
  ├── MemoryNode [plan] 0xf3a2...bd91  ⏱ 15min 🔒 encrypted
  │   ├── RelationshipEdge [reasoning-step]
  │   │   └── MemoryNode [result-1]  0x4c9d...a3f2  ⏱ 1h  🔒
  │   ├── RelationshipEdge [reasoning-step]
  │   │   └── MemoryNode [result-2]  0x7e1f...c810  ⏱ 1h  🔒
  │   ├── RelationshipEdge [reasoning-step]
  │   │   └── MemoryNode [result-3]  0x2a8b...5d04  ⏱ 1h  🔒
  │   ├── RelationshipEdge [reasoning-step]
  │   │   └── MemoryNode [result-4]  0x6d3c...7f19  ⏱ 1h  🔒
  │   └── RelationshipEdge [task-delegation]
  │       └── MemoryNode [final]     0x9e5a...2c88  ⏱ 30d 🔒
  ════════════════════════════════════════════════════════════
  Explorer: https://explorer.braga.hoodi.arkiv.network
```

---

## Monorepo Layout

```
holomem/
├── package.json              # npm workspaces root
├── tsconfig.json
├── .env.example
├── infra/
│   └── docker-compose.yml    # PostgreSQL + pgvector (port 5435)
│
├── packages/
│   ├── core/                 # @holomem/core — multi-agent Claude demo
│   │   └── src/
│   │       ├── index.ts      # CLI orchestrator + terminal UI
│   │       ├── constants.ts  # PROJECT_ATTRIBUTE, TTL config, types
│   │       ├── agents/       # planner.ts, executor.ts, consolidator.ts
│   │       ├── crypto/       # ecies.ts — client-side ECIES encryption
│   │       └── database/     # client.ts (WriteQueue), writer.ts, reader.ts
│   │
│   └── sdk-ts/               # @holomem/sdk — TypeScript SDK
│       └── src/index.ts      # HoloMem class: write/read/recall/search/link
│
├── packages/sdk-python/      # Python SDK (pip install holomem)
│   └── holomem/
│       ├── client.py         # HoloMem class
│       └── crypto.py         # ECIES encrypt/decrypt
│
└── apps/
    ├── api/                  # @holomem/api — REST API server (Fastify)
    │   └── src/
    │       ├── index.ts      # Server entrypoint
    │       ├── arkiv.ts      # All Arkiv SDK interactions
    │       ├── routes/
    │       │   ├── sessions.ts   # /v1/sessions (+ graph endpoint)
    │       │   ├── memories.ts   # /v1/memories (+ link/search/recall)
    │       │   ├── keys.ts       # /v1/keys — API key management
    │       │   ├── usage.ts      # /v1/usage
    │       │   ├── webhooks.ts   # /v1/webhooks
    │       │   ├── teams.ts      # /v1/teams
    │       │   ├── auth.ts       # /v1/auth (Google OAuth)
    │       │   └── billing.ts    # /v1/billing (Stripe)
    │       ├── db/               # PostgreSQL schema + migrations
    │       └── wallet-pool/      # Managed Arkiv wallet (WriteQueue)
    │
    └── dashboard/            # @holomem/dashboard — Next.js 14 UI
        └── app/
            ├── sessions/         # Session registry + memory graph SVG
            ├── memories/         # Memory inspector
            ├── docs/             # Interactive API documentation
            ├── settings/         # API keys, webhooks, billing
            └── teams/            # Team management
```

---

## Setup

### Prerequisites

- Node.js v22.10.0  
  ```bash
  nvm install 22.10.0 && nvm use 22.10.0
  ```
- Docker (for local PostgreSQL)
- An Anthropic API key (for the research swarm demo)

### 1. Clone and install

```bash
git clone https://github.com/jijojohny/holomem.git
cd holomem
nvm use 22.10.0
npm install
```

### 2. Get a Braga testnet wallet

Generate a new wallet:
```bash
node -e "
const { generatePrivateKey, privateKeyToAccount } = require('@arkiv-network/sdk/accounts');
const pk = generatePrivateKey();
const acc = privateKeyToAccount(pk);
console.log('Private key:', pk);
console.log('Address:', acc.address);
"
```

Fund your address at the [Braga faucet](https://arkiv.network/faucet) and check balance at [explorer.braga.hoodi.arkiv.network](https://explorer.braga.hoodi.arkiv.network).

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Arkiv / Braga testnet
BRAGA_RPC_URL=https://braga.hoodi.arkiv.network/rpc

# packages/core — Claude research swarm demo
AGENT_PRIVATE_KEY=0x<your-private-key>
ANTHROPIC_API_KEY=sk-ant-<your-key>

# apps/api — REST API server
POOL_WALLET_PRIVATE_KEY=0x<server-wallet-private-key>
DATABASE_URL=postgresql://holomem:holomem_dev@localhost:5435/holomem
PORT=3001
CORS_ORIGIN=http://localhost:3000

# apps/dashboard — Google OAuth
GOOGLE_CLIENT_ID=<your-google-client-id>
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your-google-client-id>

# Stripe (optional — for billing features)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_TEAM_PRICE_ID=price_...
APP_URL=http://localhost:3000
```

### 4. Start PostgreSQL

```bash
npm run db:up
# Starts PostgreSQL + pgvector on localhost:5435
```

### 5. Run database migrations

```bash
npm run db:migrate
# Creates: memory_index, session_index, edge_index, api_keys, usage_events, webhooks, teams, ...
```

### 6. Build all packages

```bash
npm run build
```

### 7. Start the API server

```bash
npm run api:dev
# Fastify listening on http://localhost:3001
```

### 8. Start the dashboard

```bash
npm run dashboard:dev
# Next.js on http://localhost:3005
```

### 9. Run the research swarm demo

```bash
# Full demo — writes 3 entity types to Arkiv + calls Claude
npm run demo

# Mock mode — no network calls, great for testing
npm run demo:mock

# Custom research question
node packages/core/dist/index.js "What is the future of zero-knowledge proofs in AI?"
```

---

## SDK Usage

### TypeScript / JavaScript

```bash
npm install @holomem/sdk
```

```typescript
import { HoloMem } from '@holomem/sdk';

const mem = new HoloMem({
  apiKey: 'hm_live_xxx',
  encryptionKey: 'your-64-char-hex-key', // secp256k1 private key for ECIES
});

// Write encrypted memory (episodic TTL = 1 hour)
const entityKey = await mem.write('session-abc', 'Agent reasoning step 1', {
  agentId: 'planner',
  ttl: 'episodic',
});

// Read and decrypt
const plaintext = await mem.read(entityKey);

// Recall all memories in a session
const memories = await mem.recall('session-abc', { limit: 20 });

// Vector similarity search (compute embeddings client-side)
const results = await mem.search(embedding, {
  sessionId: 'session-abc',
  threshold: 0.7,
  limit: 10,
});

// Link two memory nodes with a relationship-edge entity
const edgeKey = await mem.link(parentEntityKey, childEntityKey, {
  edgeType: 'reasoning-step',
});

// Persist encryption key to disk (load with HoloMem.loadKey)
mem.saveKey('.holomem-key');
const mem2 = HoloMem.loadKey('.holomem-key', { apiKey: 'hm_live_xxx' });
```

### Python

```bash
pip install holomem
```

```python
from holomem import HoloMem

mem = HoloMem(api_key="hm_live_xxx", encryption_key="your-64-char-hex-key")

# Write encrypted memory
entity_key = mem.write("session-abc", "Agent reasoning step 1", ttl="episodic")

# Recall all memories in a session
memories = mem.recall("session-abc")
for m in memories:
    print(m.entity_key, m.plaintext)

# Vector similarity search
results = mem.search(embedding, session_id="session-abc", threshold=0.7)

# Pin a memory (prevents TTL expiry)
mem.pin(entity_key)

# Delete a session and all its memories
deleted = mem.delete_session("session-abc")
```

### Framework integrations

HoloMem works with any agent framework. Example with CrewAI:

```python
from crewai import Agent, Task, Crew
from holomem import HoloMem

mem = HoloMem(api_key="hm_live_xxx")

def remember(session_id: str, text: str) -> str:
    return mem.write(session_id, text, ttl="episodic")

def recall(session_id: str) -> list[str]:
    return [m.plaintext for m in mem.recall(session_id)]
```

---

## REST API Reference

Base URL: `https://api.holomem.io`  
Auth: `Authorization: Bearer <api_key>`

### Sessions

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/sessions` | Explicitly create an `agent-session` entity on Arkiv |
| `GET` | `/v1/sessions` | List sessions (with `session_entity_key` and `creator`) |
| `GET` | `/v1/sessions/:id` | Single session with live Arkiv entity metadata |
| `GET` | `/v1/sessions/:id/graph` | Full on-chain graph: all 3 entity types for a session |
| `DELETE` | `/v1/sessions/:id` | Soft-delete all memories in a session |

**`GET /v1/sessions/:id/graph` — response shape:**
```json
{
  "session": { "entity_key": "0x...", "session_id": "...", "agent_id": "sdk", "creator": "0x...", "type": "agent-session" },
  "nodes": [{ "entity_key": "0x...", "session_id": "...", "agent_id": "...", "creator": "0x...", "type": "memory-node" }],
  "edges": [{ "entity_key": "0x...", "parent_key": "0x...", "child_key": "0x...", "edge_type": "linked", "session_id": "...", "type": "relationship-edge" }],
  "meta": { "project_attribute": "HOLOMEM_SYSTEM_PROD", "entity_types": ["agent-session", "memory-node", "relationship-edge"], "total": 7 }
}
```

### Memories

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/memories` | Write encrypted memory; auto-creates `agent-session` on first write |
| `GET` | `/v1/memories` | List memory index (filterable by session, agent, limit) |
| `GET` | `/v1/memories/:key` | Fetch single memory from Arkiv |
| `DELETE` | `/v1/memories/:key` | Soft-delete a memory |
| `PATCH` | `/v1/memories/:key` | Pin / unpin a memory |
| `POST` | `/v1/memories/:key/link` | Create a `relationship-edge` between two memory nodes |
| `GET` | `/v1/memories/:key/links` | List edges anchored to a memory node (on-chain verified) |
| `POST` | `/v1/memories/recall` | Recall all memories in a session |
| `POST` | `/v1/memories/search` | Vector similarity search (embeddings computed client-side) |

**`POST /v1/memories` — request body:**
```json
{
  "session_id": "my-session",
  "ciphertext": "04ab...",
  "ttl_tier": "episodic",
  "agent_id": "planner",
  "embedding": [0.12, -0.03, ...]
}
```

**`POST /v1/memories/:key/link` — request body:**
```json
{
  "child_key": "0xabc...",
  "edge_type": "reasoning-step"
}
```

### Other

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/usage` | Write/read quotas and active memory count |
| `GET/POST` | `/v1/keys` | API key management |
| `GET/POST/DELETE` | `/v1/webhooks` | Webhook endpoints (events: `write`, `delete`) |
| `GET/POST` | `/v1/teams` | Team management |
| `POST` | `/v1/auth/google` | Google OAuth sign-in |

---

## Memory Graph Visualization

The dashboard renders an interactive SVG graph for each session at `/sessions/:id`:

- **⬡ Violet hexagon** — `agent-session` entity (session root)
- **● Green circles** — `memory-node` entities (one per write)
- **◆ Blue diamonds** — `relationship-edge` entities (directed links)
- All shapes are clickable links to the Arkiv explorer
- Sessions with an on-chain `agent-session` entity show a **⬡ badge** in the session list

---

## Cryptography

HoloMem uses **ECIES (Elliptic Curve Integrated Encryption Scheme)** with the agent's Ethereum secp256k1 key pair:

- **Encryption**: `encrypt(agentPublicKey, plaintext)` — runs locally before any data leaves the machine
- **Decryption**: `decrypt(agentPrivateKey, ciphertext)` — runs locally after fetching from Arkiv
- **On-chain**: Only the ciphertext hex is stored; the Braga ledger never sees raw payloads
- **Key persistence**: `mem.saveKey(path)` / `HoloMem.loadKey(path, opts)` for cross-session recall

---

## SDK Integration Notes

This project uses `@arkiv-network/sdk` v0.6.8 against the Braga testnet.

**Key SDK patterns:**

```typescript
import { createPublicClient, createWalletClient, http } from '@arkiv-network/sdk';
import { privateKeyToAccount } from '@arkiv-network/sdk/accounts';
import { braga } from '@arkiv-network/sdk/chains';
import { eq, and } from '@arkiv-network/sdk/query';
import { ExpirationTime, jsonToPayload } from '@arkiv-network/sdk/utils';
```

**Known quirks addressed:**

| Issue | HoloMem Mitigation |
|-------|-------------------|
| Parallel nonce collisions | `WriteQueue` in `wallet-pool/` forces sequential writes |
| `NoCursorOrLimitError` on unbounded queries | Every `buildQuery().fetch()` includes `.limit(50)` |
| `attributes` must be an array | Corrected from brief's object syntax |
| `expiresIn` takes seconds not blocks | Use `ExpirationTime.fromMinutes(N)` |
| Destructive attribute replacement on `updateEntity` | Read → merge → write pattern |
| Brief RPC URL typo (`/` vs `//rpc`) | Use `transport: http()` to rely on chain defaults |

---

## Hackathon Compliance

**Web3 Database Builder Challenge — Arkiv Braga testnet**

| Requirement | Status |
|------------|--------|
| Unique `PROJECT_ATTRIBUTE` on every entity & query | `{ key: 'project', value: 'HOLOMEM_SYSTEM_PROD' }` |
| At least 2 entity types | 3 types: `agent-session`, `memory-node`, `relationship-edge` |
| Open-source GitHub repository | [github.com/jijojohny/holomem](https://github.com/jijojohny/holomem) |
| Working demo link | [holomem-dashboard.vercel.app](https://holomem-dashboard.vercel.app) |
| README with setup instructions | This document |
| Theme: AI | Cryptographic memory mesh for autonomous AI agent swarms |

---

## License

MIT — see [LICENSE](./LICENSE)

Built for the **Web3 Database Builder Challenge** on Arkiv Braga testnet.
