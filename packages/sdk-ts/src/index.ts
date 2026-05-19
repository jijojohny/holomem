import { encrypt, decrypt, PrivateKey } from 'eciesjs';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const API_BASE = 'https://api.holomem.io';

export type TtlTier = 'working' | 'episodic' | 'persistent';

export interface HoloMemOptions {
  apiKey: string;
  encryptionKey?: string;
  baseUrl?: string;
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

export class HoloMem {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly privKey: PrivateKey;

  constructor(opts: HoloMemOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? API_BASE;

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
    const result = await this.request('POST', '/v1/memories', {
      session_id: sessionId,
      ciphertext,
      ttl_tier: opts?.ttl ?? 'episodic',
      agent_id: opts?.agentId,
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
}
