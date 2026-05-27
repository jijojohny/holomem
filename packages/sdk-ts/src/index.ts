import { encrypt, decrypt, PrivateKey } from 'eciesjs';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const API_BASE = 'https://holomem-production.up.railway.app';

export type TtlTier = 'working' | 'episodic' | 'persistent';

export interface HoloMemOptions {
  apiKey: string;
  encryptionKey?: string;
  baseUrl?: string;
  embed?: (text: string) => Promise<number[]>;
}

export interface Memory {
  entityKey: string;
  agentId: string;
  plaintext: string;
}

export interface UsageResponse {
  tier: string;
  writes: { used: number; limit: number | null; remaining: number | null; resets_at: string };
  reads: { this_month: number };
  memories: { active: number };
}

export interface SessionEntry {
  sessionId: string;
  memoryCount: number;
  lastActivity: string;
}

export interface MemoryIndexEntry {
  entityKey: string;
  sessionId: string;
  agentId: string | null;
  ttlTier: TtlTier;
  createdAt: string;
  expiresAt: string;
  pinned: boolean;
}

export interface SearchResult {
  entityKey: string;
  sessionId: string;
  agentId: string | null;
  ttlTier: TtlTier;
  createdAt: string;
  expiresAt: string;
  pinned: boolean;
  score: number;
  plaintext: string;
}

export class HoloMem {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly privKey: PrivateKey;
  private readonly embedFn?: (text: string) => Promise<number[]>;

  constructor(opts: HoloMemOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? API_BASE;
    this.embedFn = opts.embed;

    if (opts.encryptionKey) {
      this.privKey = new PrivateKey(Buffer.from(opts.encryptionKey, 'hex'));
    } else {
      this.privKey = new PrivateKey();
      console.warn(
        '[holomem] No encryptionKey provided — generating ephemeral key. ' +
        'Memories written in this session cannot be recalled after restart. ' +
        'Pass encryptionKey to HoloMem constructor for persistence.',
      );
    }
  }

  // ── Static factory: load encryption key from file ──────────────────────────

  static loadKey(keyPath: string, opts: Omit<HoloMemOptions, 'encryptionKey'>): HoloMem {
    if (!existsSync(keyPath)) {
      throw new Error(`HoloMem key file not found: ${keyPath}`);
    }
    const encryptionKey = readFileSync(keyPath, 'utf8').trim();
    return new HoloMem({ ...opts, encryptionKey });
  }

  // ── Instance: save encryption key to file ─────────────────────────────────

  saveKey(keyPath: string): void {
    writeFileSync(keyPath, this.privateKeyHex, { mode: 0o600 });
  }

  // ── Key accessors ──────────────────────────────────────────────────────────

  get publicKeyHex(): string {
    return this.privKey.publicKey.toHex();
  }

  get privateKeyHex(): string {
    return Buffer.from(this.privKey.secret).toString('hex');
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private encrypt(plaintext: string): string {
    return Buffer.from(encrypt(this.privKey.publicKey.toHex(), Buffer.from(plaintext, 'utf8'))).toString('hex');
  }

  private decrypt(ciphertextHex: string): string {
    return Buffer.from(decrypt(Buffer.from(this.privKey.secret).toString('hex'), Buffer.from(ciphertextHex, 'hex'))).toString('utf8');
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
      throw new Error(`HoloMem API error ${res.status}: ${err.error}`);
    }

    if (res.status === 204) return null;
    return res.json();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async write(sessionId: string, plaintext: string, opts?: { agentId?: string; ttl?: TtlTier }): Promise<string> {
    const ciphertext = this.encrypt(plaintext);
    const embedding = this.embedFn ? await this.embedFn(plaintext) : undefined;
    const result = await this.request('POST', '/v1/memories', {
      session_id: sessionId,
      ciphertext,
      ttl_tier: opts?.ttl ?? 'episodic',
      agent_id: opts?.agentId,
      embedding,
    }) as { entity_key: string };
    return result.entity_key;
  }

  async read(entityKey: string): Promise<string | null> {
    const result = await this.request('GET', `/v1/memories/${entityKey}`) as { ciphertext: string | null };
    if (!result.ciphertext) return null;
    return this.decrypt(result.ciphertext);
  }

  async recall(sessionId: string, opts?: { limit?: number }): Promise<Memory[]> {
    const result = await this.request('POST', '/v1/memories/recall', {
      session_id: sessionId,
      limit: opts?.limit ?? 20,
    }) as { memories: Array<{ entity_key: string; agent_id: string; ciphertext: string | null }> };

    return result.memories
      .filter((m) => m.ciphertext !== null)
      .map((m) => ({
        entityKey: m.entity_key,
        agentId: m.agent_id,
        plaintext: this.decrypt(m.ciphertext!),
      }));
  }

  async delete(entityKey: string): Promise<void> {
    await this.request('DELETE', `/v1/memories/${entityKey}`);
  }

  async usage(): Promise<UsageResponse> {
    return this.request('GET', '/v1/usage') as Promise<UsageResponse>;
  }

  async listSessions(): Promise<SessionEntry[]> {
    const result = await this.request('GET', '/v1/sessions') as {
      sessions: Array<{ session_id: string; memory_count: number; last_activity: string }>;
    };
    return result.sessions.map((s) => ({
      sessionId: s.session_id,
      memoryCount: s.memory_count,
      lastActivity: s.last_activity,
    }));
  }

  async deleteSession(sessionId: string): Promise<number> {
    const result = await this.request('DELETE', `/v1/sessions/${encodeURIComponent(sessionId)}`) as { deleted: number };
    return result.deleted;
  }

  async writeMany(sessionId: string, texts: string[], opts?: { agentId?: string; ttl?: TtlTier }): Promise<string[]> {
    return Promise.all(texts.map((text) => this.write(sessionId, text, opts)));
  }

  async listMemories(opts?: { sessionId?: string; agentId?: string; limit?: number }): Promise<MemoryIndexEntry[]> {
    const params = new URLSearchParams();
    if (opts?.sessionId) params.set('session_id', opts.sessionId);
    if (opts?.agentId) params.set('agent_id', opts.agentId);
    if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
    const qs = params.toString();
    const result = await this.request('GET', `/v1/memories${qs ? `?${qs}` : ''}`) as {
      memories: Array<{
        entity_key: string;
        session_id: string;
        agent_id: string | null;
        ttl_tier: TtlTier;
        created_at: string;
        expires_at: string;
        pinned: boolean;
      }>;
    };
    return result.memories.map((m) => ({
      entityKey: m.entity_key,
      sessionId: m.session_id,
      agentId: m.agent_id,
      ttlTier: m.ttl_tier,
      createdAt: m.created_at,
      expiresAt: m.expires_at,
      pinned: m.pinned ?? false,
    }));
  }

  async search(
    queryText: string,
    opts?: { sessionId?: string; agentId?: string; limit?: number; threshold?: number },
  ): Promise<SearchResult[]> {
    if (!this.embedFn) {
      throw new Error('search() requires an embed callback — pass embed: fn to HoloMem constructor');
    }
    const embedding = await this.embedFn(queryText);
    const result = await this.request('POST', '/v1/memories/search', {
      embedding,
      session_id: opts?.sessionId,
      agent_id: opts?.agentId,
      limit: opts?.limit ?? 10,
      threshold: opts?.threshold ?? 0.7,
    }) as {
      memories: Array<{
        entity_key: string;
        session_id: string;
        agent_id: string | null;
        ttl_tier: TtlTier;
        created_at: string;
        expires_at: string;
        pinned: boolean;
        score: number;
        ciphertext: string | null;
      }>;
    };

    return result.memories
      .filter((m) => m.ciphertext !== null)
      .map((m) => ({
        entityKey: m.entity_key,
        sessionId: m.session_id,
        agentId: m.agent_id,
        ttlTier: m.ttl_tier,
        createdAt: m.created_at,
        expiresAt: m.expires_at,
        pinned: m.pinned,
        score: m.score,
        plaintext: this.decrypt(m.ciphertext!),
      }));
  }

  async pin(entityKey: string): Promise<void> {
    await this.request('PATCH', `/v1/memories/${entityKey}`, { pinned: true });
  }

  async unpin(entityKey: string): Promise<void> {
    await this.request('PATCH', `/v1/memories/${entityKey}`, { pinned: false });
  }
}
