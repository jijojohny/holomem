/**
 * Integration test — runs against a live API server on localhost:3001.
 *
 * Prerequisites:
 *   npm run db:up && npm run db:migrate
 *   npm run api:dev   (in a separate terminal)
 *
 * Run:
 *   node --env-file ../../.env --import tsx/esm src/test-integration.ts
 */

import { HoloMem, type Memory } from '@holomem/sdk';

const BASE_URL = 'http://localhost:3001';
const TEST_EMAIL = `test-${Date.now()}@example.com`;

let passed = 0;
let failed = 0;

function ok(label: string) {
  console.log(`  ✓ ${label}`);
  passed++;
}

function fail(label: string, err: unknown) {
  console.error(`  ✗ ${label}:`, err instanceof Error ? err.message : String(err));
  failed++;
}

async function apiPost(path: string, body: unknown, apiKey?: string): Promise<unknown> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function run() {
  console.log('\n=== HoloMem Integration Test ===\n');

  // 1. Health check
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const j = await res.json() as { status: string };
    if (j.status !== 'ok') throw new Error('unexpected status');
    ok('GET /health');
  } catch (e) {
    fail('GET /health', e);
    console.error('\nIs the API server running? Start it with: npm run api:dev\n');
    process.exit(1);
  }

  // 2. Issue an API key (sign-up)
  let apiKey = '';
  try {
    const result = await apiPost('/v1/keys', { email: TEST_EMAIL }) as { api_key: string };
    apiKey = result.api_key;
    if (!apiKey.startsWith('hm_live_')) throw new Error('wrong key format');
    ok(`POST /v1/keys → ${apiKey.slice(0, 12)}...`);
  } catch (e) {
    fail('POST /v1/keys', e);
    process.exit(1);
  }

  // 3. Write a memory via TypeScript SDK
  const mem = new HoloMem({ apiKey, baseUrl: BASE_URL });
  const SESSION = `test-session-${Date.now()}`;
  let entityKey = '';

  try {
    entityKey = await mem.write(SESSION, 'User wants to book a flight to Tokyo on July 5th', {
      agentId: 'test-agent',
      ttl: 'episodic',
    });
    if (!entityKey.startsWith('0x')) throw new Error('entity key should be 0x hex');
    ok(`write() → ${entityKey.slice(0, 14)}...`);
  } catch (e) {
    fail('write()', e);
  }

  // 4. Read the memory back
  if (entityKey) {
    try {
      const plaintext = await mem.read(entityKey);
      if (!plaintext?.includes('Tokyo')) throw new Error(`decrypted value unexpected: ${plaintext}`);
      ok(`read() → "${plaintext}"`);
    } catch (e) {
      fail('read()', e);
    }
  }

  // 5. Write a second memory
  let entityKey2 = '';
  try {
    entityKey2 = await mem.write(SESSION, 'User prefers window seats', { agentId: 'test-agent' });
    ok(`write() second memory → ${entityKey2.slice(0, 14)}...`);
  } catch (e) {
    fail('write() second memory', e);
  }

  // 6. Recall all memories in session
  try {
    const memories = await mem.recall(SESSION);
    if (memories.length < 2) throw new Error(`expected ≥2, got ${memories.length}`);
    const texts = memories.map((m: Memory) => m.plaintext);
    if (!texts.some((t: string) => t.includes('Tokyo'))) throw new Error('Tokyo memory missing from recall');
    if (!texts.some((t: string) => t.includes('window'))) throw new Error('window seats memory missing from recall');
    ok(`recall() → ${memories.length} memories, all decrypted correctly`);
  } catch (e) {
    fail('recall()', e);
  }

  // 7. Delete a memory
  if (entityKey2) {
    try {
      await mem.delete(entityKey2);
      ok(`delete(${entityKey2.slice(0, 14)}...)`);
    } catch (e) {
      fail('delete()', e);
    }
  }

  // 8. Confirm deleted memory no longer in recall
  try {
    const memories = await mem.recall(SESSION);
    if (memories.some((m: Memory) => m.entityKey === entityKey2)) {
      throw new Error('deleted memory still appears in recall');
    }
    ok('recall() after delete excludes deleted memory');
  } catch (e) {
    fail('recall() after delete', e);
  }

  // 9. List API keys for the customer
  try {
    const res = await fetch(`${BASE_URL}/v1/keys`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const j = await res.json() as { keys: unknown[] };
    if (!j.keys?.length) throw new Error('no keys returned');
    ok(`GET /v1/keys → ${j.keys.length} key(s)`);
  } catch (e) {
    fail('GET /v1/keys', e);
  }

  // 10. GET /v1/usage — check write count incremented
  try {
    const usage = await mem.usage();
    if (typeof usage.writes.used !== 'number') throw new Error('writes.used missing');
    if (usage.writes.used < 2) throw new Error(`expected ≥2 writes recorded, got ${usage.writes.used}`);
    if (usage.tier !== 'free') throw new Error(`unexpected tier: ${usage.tier}`);
    ok(`GET /v1/usage → ${usage.writes.used} writes used, tier=${usage.tier}`);
  } catch (e) {
    fail('GET /v1/usage', e);
  }

  // 11. saveKey / loadKey round-trip
  try {
    const keyPath = `/tmp/holomem-test-${Date.now()}.key`;
    mem.saveKey(keyPath);
    const mem2 = HoloMem.loadKey(keyPath, { apiKey, baseUrl: BASE_URL });
    // mem2 should decrypt mem's memories
    const plaintext = await mem2.read(entityKey);
    if (!plaintext?.includes('Tokyo')) throw new Error(`key round-trip failed: "${plaintext}"`);
    ok('saveKey() / loadKey() round-trip — same key decrypts existing memories');
  } catch (e) {
    fail('saveKey / loadKey', e);
  }

  // 12. Invalid API key is rejected
  try {
    const res = await fetch(`${BASE_URL}/v1/memories/recall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer hm_live_bad_key' },
      body: JSON.stringify({ session_id: SESSION }),
    });
    if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
    ok('invalid API key → 401');
  } catch (e) {
    fail('auth rejection', e);
  }

  console.log(`\n${'─'.repeat(44)}`);
  console.log(`  ${passed} passed  ${failed > 0 ? `${failed} failed` : 'all passing'}`);
  console.log('');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
