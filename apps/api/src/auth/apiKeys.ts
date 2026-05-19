import { createHash, randomBytes } from 'crypto';
import { db } from '../db/pool.js';

export type ApiKeyEnv = 'live' | 'test';
export type Tier = 'free' | 'pro' | 'team' | 'enterprise';

export interface ApiKeyRecord {
  id: string;
  customer_id: string;
  tier: Tier;
  env: ApiKeyEnv;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function generateApiKey(env: ApiKeyEnv = 'live'): string {
  const secret = randomBytes(24).toString('base64url');
  return `hm_${env}_${secret}`;
}

export async function createApiKey(customerId: string, env: ApiKeyEnv = 'live', tier: Tier = 'free'): Promise<string> {
  const key = generateApiKey(env);
  const keyHash = sha256(key);
  const keyPrefix = key.slice(0, 12);

  await db.query(
    `INSERT INTO api_keys (customer_id, key_hash, key_prefix, env, tier)
     VALUES ($1, $2, $3, $4, $5)`,
    [customerId, keyHash, keyPrefix, env, tier],
  );

  return key;
}

export async function verifyApiKey(rawKey: string): Promise<ApiKeyRecord | null> {
  const keyHash = sha256(rawKey);
  const result = await db.query<ApiKeyRecord & { revoked_at: string | null }>(
    `SELECT id, customer_id, tier, env, revoked_at
     FROM api_keys
     WHERE key_hash = $1`,
    [keyHash],
  );

  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  if (row.revoked_at) return null;
  return { id: row.id, customer_id: row.customer_id, tier: row.tier, env: row.env };
}

export async function revokeApiKey(keyId: string): Promise<void> {
  await db.query(
    `UPDATE api_keys SET revoked_at = NOW() WHERE id = $1`,
    [keyId],
  );
}
