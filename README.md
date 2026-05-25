# HoloMem

**Cryptographic Memory Mesh for Autonomous Collaborative Agent Swarms**

HoloMem is an open-source, decentralized agent memory network built on [Arkiv](https://arkiv.network) — Ethereum's modular L2 data layer. It gives multi-agent AI systems a shared, **private, auto-pruning, user-owned** memory layer on-chain.

```
╔══════════════════════════════════════════════════════════════╗
║        HoloMem: Cryptographic Memory Mesh                    ║
║        Multi-Agent Research Swarm on Arkiv Braga             ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Why HoloMem?

| Problem | HoloMem Solution |
|---------|-----------------|
| Agents forget between sessions | Persistent on-chain memory with configurable TTL |
| Centralized vector DBs (Pinecone) lock your data | User-owned entities via Arkiv `$owner` field |
| Public ledgers expose raw agent logs | ECIES client-side encryption before any data hits the chain |
| L1 smart contracts are too expensive for agent writes | Arkiv L3 DB-Chains with predictable GLM-based pricing |
| No native memory pruning | Time-scoped `expiresIn` auto-removes expired context |
| Single-agent silos | Relational `MemoryNode → RelationshipEdge` on-chain graph |

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
  │  MemoryNode [plan]   ←──── RelationshipEdge [reasoning]    │
  │  MemoryNode [result] ←──── RelationshipEdge [delegation]   │
  │  MemoryNode [final]                                         │
  │                                                             │
  │  • $creator  : immutable write attribution                  │
  │  • $owner    : mutable control (transfer to sub-agents)     │
  │  • expiresIn : auto-prune from index after TTL              │
  └─────────────────────────────────────────────────────────────┘
         │
         ▼
  Ethereum (via Arkiv L2 coordination layer / OP Stack)
```

### Memory Tiers

| Tier | TTL | Contents |
|------|-----|----------|
| Working Memory | 15 min | Planner instructions, draft steps |
| Episodic | 1 hour | Executor research findings per session |
| Persistent | 30 days | Final consolidated reports, cross-session context |

---

## Demo: The Research Swarm

```
◉ Planner Agent initializing research session...
✓ Plan written to Arkiv  entityKey: 0xf3a2...bd91  TTL: 15min
  Research plan:
    1. Current State     — Analyze the current state of decentralized AI
    2. Key Challenges    — Identify major technical and adoption challenges
    3. Opportunities     — Map key growth vectors and use cases
    4. Future Outlook    — Project where this will be in 5 years

◉ Executor #1 researching "Current State"...
✓ Executor #1 result written  entityKey: 0x4c9d...a3f2  edge: 0x8b1c...
◉ Executor #2 researching "Key Challenges"...
✓ Executor #2 result written  entityKey: 0x7e1f...c810  edge: 0x2d4e...
◉ Executor #3 researching "Opportunities"...
✓ Executor #3 result written  entityKey: 0x2a8b...5d04  edge: 0x6f91...
◉ Executor #4 researching "Future Outlook"...
✓ Executor #4 result written  entityKey: 0x6d3c...7f19  edge: 0x3c27...

◉ Consolidator Agent synthesizing 4 research threads...
✓ Final report written  entityKey: 0x9e5a...2c88  TTL: 30d

  Memory Graph (session: a3f9d201)
  ════════════════════════════════════════════════════════════
  MemoryNode [plan]  0xf3a2...bd91  ⏱ 15min TTL  🔒 encrypted
  ├── RelationshipEdge [reasoning-step]
  │   └── MemoryNode [result-1]  0x4c9d...a3f2  ⏱ 1h TTL  🔒 encrypted
  ├── RelationshipEdge [reasoning-step]
  │   └── MemoryNode [result-2]  0x7e1f...c810  ⏱ 1h TTL  🔒 encrypted
  ├── RelationshipEdge [reasoning-step]
  │   └── MemoryNode [result-3]  0x2a8b...5d04  ⏱ 1h TTL  🔒 encrypted
  ├── RelationshipEdge [reasoning-step]
  │   └── MemoryNode [result-4]  0x6d3c...7f19  ⏱ 1h TTL  🔒 encrypted
  └── RelationshipEdge [task-delegation]
      └── MemoryNode [final]     0x9e5a...2c88  ⏱ 30d TTL  🔒 encrypted
  ════════════════════════════════════════════════════════════
  Explorer: https://explorer.braga.hoodi.arkiv.network
```

---

## Setup

### Prerequisites
- Node.js v22.10.0 (use nvm: `nvm install 22.10.0 && nvm use 22.10.0`)
- An Anthropic API key

### 1. Clone and install

```bash
git clone https://github.com/jijojohny/holomem.git
cd holomem
nvm use 22.10.0
npm install
```

### 2. Get a Braga testnet wallet

Option A — Generate a new wallet:
```bash
node -e "
const { generatePrivateKey, privateKeyToAccount } = require('@arkiv-network/sdk/accounts');
const pk = generatePrivateKey();
const acc = privateKeyToAccount(pk);
console.log('Private key:', pk);
console.log('Address:', acc.address);
"
```

Option B — Use the sample key from the Arkiv docs (pre-funded on Braga testnet).

Fund your address at the Braga faucet: https://arkiv.network/faucet  
Check your balance: https://explorer.braga.hoodi.arkiv.network

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env and set:
#   AGENT_PRIVATE_KEY=0x<your-private-key>
#   ANTHROPIC_API_KEY=sk-ant-<your-key>
```

### 4. Build and run

```bash
npm run build

# Full demo (writes to Arkiv + calls Claude)
npm run demo

# Mock mode (no network calls — great for testing the UI)
npm run demo:mock

# Custom research question
node dist/index.js "What is the future of zero-knowledge proofs in AI?"
```

---

## Repository Layout

```
holomem-core/
├── package.json
├── tsconfig.json
├── .nvmrc                 # Pin Node.js 22.10.0
├── .env.example
├── README.md
└── src/
    ├── index.ts           # CLI orchestrator + terminal UI
    ├── constants.ts       # PROJECT_ATTRIBUTE, TTL config, types
    ├── agents/
    │   ├── planner.ts     # Claude planner: breaks question into 4 steps
    │   ├── executor.ts    # Claude executor: researches one step
    │   └── consolidator.ts # Claude consolidator: synthesizes final report
    ├── crypto/
    │   └── ecies.ts       # Client-side ECIES encryption (secp256k1)
    └── database/
        ├── client.ts      # publicClient, walletClient, WriteQueue
        ├── writer.ts      # createMemoryNode, createRelationshipEdge
        └── reader.ts      # getMemoryNode, getChildMemories, queryBySession
```

---

## SDK Integration Notes

This project uses `@arkiv-network/sdk` v0.6.8 against the Braga testnet.

**Key SDK quirks addressed:**

| Issue | HoloMem Mitigation |
|-------|-------------------|
| Brief lists wrong RPC URL (`/` → should be `/rpc`) | Use `transport: http()` to use chain defaults from SDK |
| Destructive attribute replacement on `updateEntity` | `safeUpdateMemoryNode` does Read → Merge → Write |
| `NoCursorOrLimitError` on unbounded queries | Every `buildQuery().fetch()` includes `.limit(50)` |
| Parallel nonce collisions | `WriteQueue` forces sequential ordering of all writes |
| `attributes` must be an array (`[]`) | Corrected from brief's object syntax |
| `expiresIn` takes seconds (not blocks) | Use `ExpirationTime.fromMinutes(N)` etc. |

---

## Key SDK Subpath Imports

```typescript
import { createPublicClient, createWalletClient, http } from '@arkiv-network/sdk';
import { privateKeyToAccount, generatePrivateKey } from '@arkiv-network/sdk/accounts';
import { braga } from '@arkiv-network/sdk/chains';
import { eq, and, or } from '@arkiv-network/sdk/query';
import { ExpirationTime, jsonToPayload } from '@arkiv-network/sdk/utils';
```

---

## Cryptography

HoloMem uses **ECIES (Elliptic Curve Integrated Encryption Scheme)** with the agent's Ethereum secp256k1 key pair:

- **Encryption**: `encrypt(agentPublicKey, plaintext)` — runs locally before any data leaves the machine
- **Decryption**: `decrypt(agentPrivateKey, ciphertext)` — runs locally after fetching from Arkiv
- **On-chain**: Only the ciphertext hex is stored; the Braga ledger never sees raw payloads

---

## License

MIT — see [LICENSE](./LICENSE)

Built for the **Web3 Database Builder Challenge** on Arkiv Braga testnet.

---

## Demo

**Live dashboard:** [https://holomem-dashboard.vercel.app](https://holomem-dashboard.vercel.app)

**GitHub:** [https://github.com/jijojohny/holomem](https://github.com/jijojohny/holomem)

**Arkiv explorer:** [https://explorer.braga.hoodi.arkiv.network](https://explorer.braga.hoodi.arkiv.network)

**Submission theme:** AI — cryptographic memory mesh for autonomous collaborative agent swarms.
