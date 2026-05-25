import type { FastifyInstance } from 'fastify';
import { db } from '../db/pool.js';
import {
  writeMemory, readMemory, listSessionMemories, TTL_SECONDS,
  writeRelationshipEdge, listEdgesByParent,
  type TtlTier,
} from '../arkiv.js';
import { deliverWebhooks } from '../webhooks.js';
import '../types.js';

const TTL_TIERS: TtlTier[] = ['working', 'episodic', 'persistent'];

interface WriteBody {
  session_id: string;
  ciphertext: string;
  ttl_tier?: TtlTier;
  agent_id?: string;
  embedding?: number[];
}

interface SearchBody {
  embedding: number[];
  session_id?: string;
  agent_id?: string;
  limit?: number;
  threshold?: number;
}

interface RecallBody {
  session_id: string;
  limit?: number;
}

export async function memoriesRoutes(app: FastifyInstance) {
  // POST /v1/memories — write an encrypted memory to Arkiv
  app.post<{ Body: WriteBody }>('/v1/memories', async (req, reply) => {
    const { session_id, ciphertext, ttl_tier = 'episodic', agent_id, embedding } = req.body;

    if (!session_id || typeof session_id !== 'string') {
      return reply.status(400).send({ error: 'session_id is required' });
    }
    if (!ciphertext || typeof ciphertext !== 'string') {
      return reply.status(400).send({ error: 'ciphertext is required' });
    }
    if (!TTL_TIERS.includes(ttl_tier)) {
      return reply.status(400).send({ error: `ttl_tier must be one of: ${TTL_TIERS.join(', ')}` });
    }

    const { entityKey, txHash } = await writeMemory({
      sessionId: session_id,
      agentId: agent_id,
      ciphertext,
      ttlTier: ttl_tier,
    });

    const ttlSeconds = TTL_SECONDS[ttl_tier];
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const embeddingValue = embedding ? `[${embedding.join(',')}]` : null;
    await db.query(
      `INSERT INTO memory_index (entity_key, api_key_id, session_id, agent_id, ttl_tier, expires_at, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [entityKey, req.apiKey.id, session_id, agent_id ?? 'sdk', ttl_tier, expiresAt.toISOString(), embeddingValue],
    );

    await db.query(
      `INSERT INTO usage_events (api_key_id, event_type, session_id, entity_key)
       VALUES ($1, 'write', $2, $3)`,
      [req.apiKey.id, session_id, entityKey],
    );

    deliverWebhooks(req.apiKey.id, 'write', { entity_key: entityKey, session_id, agent_id, ttl_tier });

    return reply.status(201).send({ entity_key: entityKey, tx_hash: txHash, expires_at: expiresAt.toISOString() });
  });

  // GET /v1/memories/:key — fetch a single memory by entity key
  app.get<{ Params: { key: string } }>('/v1/memories/:key', async (req, reply) => {
    const { key } = req.params;

    const indexRow = await db.query(
      `SELECT entity_key FROM memory_index
       WHERE entity_key = $1 AND api_key_id = $2 AND deleted_at IS NULL AND (pinned = TRUE OR expires_at > NOW())`,
      [key, req.apiKey.id],
    );
    if (indexRow.rowCount === 0) {
      return reply.status(404).send({ error: 'memory not found or expired' });
    }

    const memory = await readMemory(key);
    if (!memory) {
      return reply.status(404).send({ error: 'memory not found on Arkiv' });
    }

    await db.query(
      `INSERT INTO usage_events (api_key_id, event_type, session_id, entity_key)
       VALUES ($1, 'read', $2, $3)`,
      [req.apiKey.id, memory.sessionId, key],
    );

    return reply.send({
      entity_key: memory.entityKey,
      session_id: memory.sessionId,
      agent_id: memory.agentId,
      ciphertext: memory.ciphertext,
    });
  });

  // GET /v1/memories/session/:id — list all memories in a session
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>('/v1/memories/session/:id', async (req, reply) => {
    const { id: sessionId } = req.params;
    const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 50);

    const indexRows = await db.query(
      `SELECT entity_key FROM memory_index
       WHERE session_id = $1 AND api_key_id = $2 AND deleted_at IS NULL AND (pinned = TRUE OR expires_at > NOW())
       ORDER BY pinned DESC, created_at DESC
       LIMIT $3`,
      [sessionId, req.apiKey.id, limit],
    );
    if (indexRows.rowCount === 0) {
      return reply.send({ session_id: sessionId, memories: [] });
    }

    const entityKeys: string[] = indexRows.rows.map((r) => r.entity_key);

    const memories = await listSessionMemories(sessionId);
    const filtered = memories.filter((m) => entityKeys.includes(m.entityKey));

    await db.query(
      `INSERT INTO usage_events (api_key_id, event_type, session_id)
       VALUES ($1, 'read', $2)`,
      [req.apiKey.id, sessionId],
    );

    return reply.send({
      session_id: sessionId,
      memories: filtered.map((m) => ({
        entity_key: m.entityKey,
        agent_id: m.agentId,
        ciphertext: m.ciphertext,
      })),
    });
  });

  // DELETE /v1/memories/:key — soft-delete (marks deleted in index; Arkiv TTL handles on-chain expiry)
  app.delete<{ Params: { key: string } }>('/v1/memories/:key', async (req, reply) => {
    const { key } = req.params;

    const result = await db.query(
      `UPDATE memory_index
       SET deleted_at = NOW()
       WHERE entity_key = $1 AND api_key_id = $2 AND deleted_at IS NULL
       RETURNING entity_key`,
      [key, req.apiKey.id],
    );

    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'memory not found or already deleted' });
    }

    await db.query(
      `INSERT INTO usage_events (api_key_id, event_type, entity_key)
       VALUES ($1, 'delete', $2)`,
      [req.apiKey.id, key],
    );

    deliverWebhooks(req.apiKey.id, 'delete', { entity_key: key });

    return reply.status(204).send();
  });

  // GET /v1/memories — list memory index entries for the authenticated key
  app.get<{ Querystring: { session_id?: string; agent_id?: string; limit?: string } }>('/v1/memories', async (req, reply) => {
    const { session_id, agent_id, limit: limitStr } = req.query;
    const limit = Math.min(parseInt(limitStr ?? '100', 10), 100);

    const conditions: string[] = [
      'api_key_id = $1',
      'deleted_at IS NULL',
      '(pinned = TRUE OR expires_at > NOW())',
    ];
    const params: unknown[] = [req.apiKey.id, limit];

    if (session_id) {
      conditions.push(`session_id = $${params.length + 1}`);
      params.push(session_id);
    }
    if (agent_id) {
      conditions.push(`agent_id = $${params.length + 1}`);
      params.push(agent_id);
    }

    const rows = await db.query<{
      entity_key: string;
      session_id: string;
      agent_id: string | null;
      ttl_tier: string;
      created_at: string;
      expires_at: string;
      pinned: boolean;
    }>(
      `SELECT entity_key, session_id, agent_id, ttl_tier, created_at, expires_at, pinned
       FROM memory_index
       WHERE ${conditions.join(' AND ')}
       ORDER BY pinned DESC, created_at DESC
       LIMIT $2`,
      params,
    );

    return reply.send({ memories: rows.rows });
  });

  // PATCH /v1/memories/:key — pin or unpin a memory node
  app.patch<{ Params: { key: string }; Body: { pinned: boolean } }>('/v1/memories/:key', async (req, reply) => {
    const { key } = req.params;
    const { pinned } = req.body;

    if (typeof pinned !== 'boolean') {
      return reply.status(400).send({ error: 'pinned must be a boolean' });
    }

    const result = await db.query<{ entity_key: string; pinned: boolean }>(
      `UPDATE memory_index
       SET pinned = $1
       WHERE entity_key = $2 AND api_key_id = $3 AND deleted_at IS NULL
       RETURNING entity_key, pinned`,
      [pinned, key, req.apiKey.id],
    );

    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'memory not found' });
    }

    return reply.send({ entity_key: result.rows[0].entity_key, pinned: result.rows[0].pinned });
  });

  // POST /v1/memories/search — vector similarity search (embeddings computed client-side)
  app.post<{ Body: SearchBody }>('/v1/memories/search', async (req, reply) => {
    const { embedding, session_id, agent_id, limit = 10 } = req.body;
    const rawThreshold = req.body.threshold ?? 0.7;
    const threshold = Math.max(0, Math.min(1, typeof rawThreshold === 'number' ? rawThreshold : 0.7));

    if (!Array.isArray(embedding) || embedding.length === 0) {
      return reply.status(400).send({ error: 'embedding array is required' });
    }
    if (!embedding.every((v) => typeof v === 'number' && isFinite(v))) {
      return reply.status(400).send({ error: 'embedding must be an array of finite numbers' });
    }

    const safeLimit = Math.min(typeof limit === 'number' ? limit : 10, 50);
    const vecStr = `[${embedding.join(',')}]`;

    const conditions: string[] = [
      'api_key_id = $1',
      'deleted_at IS NULL',
      '(pinned = TRUE OR expires_at > NOW())',
      'embedding IS NOT NULL',
      '(1 - (embedding <=> $2::vector)) >= $3',
    ];
    const params: unknown[] = [req.apiKey.id, vecStr, threshold, safeLimit];

    if (session_id) {
      conditions.push(`session_id = $${params.length + 1}`);
      params.push(session_id);
    }
    if (agent_id) {
      conditions.push(`agent_id = $${params.length + 1}`);
      params.push(agent_id);
    }

    const rows = await db.query<{
      entity_key: string;
      session_id: string;
      agent_id: string | null;
      ttl_tier: string;
      created_at: string;
      expires_at: string;
      pinned: boolean;
      score: number;
    }>(
      `SELECT entity_key, session_id, agent_id, ttl_tier, created_at, expires_at, pinned,
              (1 - (embedding <=> $2::vector)) AS score
       FROM memory_index
       WHERE ${conditions.join(' AND ')}
       ORDER BY embedding <=> $2::vector
       LIMIT $4`,
      params,
    );

    if (rows.rowCount === 0) {
      return reply.send({ memories: [] });
    }

    const entityKeys = rows.rows.map((r) => r.entity_key);

    // Build ciphertext map: batch-fetch session memories when scoped; else individual reads
    const ciphertextMap = new Map<string, string>();
    if (session_id) {
      const sessionMems = await listSessionMemories(session_id);
      for (const m of sessionMems) {
        if (m.ciphertext) ciphertextMap.set(m.entityKey, m.ciphertext);
      }
    }
    // Fetch any not covered by the session batch (cross-session or session not provided)
    await Promise.all(
      entityKeys
        .filter((k) => !ciphertextMap.has(k))
        .map(async (key) => {
          const fetched = await readMemory(key);
          if (fetched?.ciphertext) ciphertextMap.set(key, fetched.ciphertext);
        }),
    );

    return reply.send({
      memories: rows.rows.map((r) => ({
        entity_key: r.entity_key,
        session_id: r.session_id,
        agent_id: r.agent_id,
        ttl_tier: r.ttl_tier,
        created_at: r.created_at,
        expires_at: r.expires_at,
        pinned: r.pinned,
        score: r.score,
        ciphertext: ciphertextMap.get(r.entity_key) ?? null,
      })),
    });
  });

  // POST /v1/memories/:key/link — create a relationship-edge entity linking two memory nodes
  app.post<{ Params: { key: string }; Body: { child_key: string; edge_type?: string } }>('/v1/memories/:key/link', async (req, reply) => {
    const parentKey = req.params.key;
    const { child_key: childKey, edge_type: edgeType = 'linked' } = req.body;

    if (!childKey || typeof childKey !== 'string') {
      return reply.status(400).send({ error: 'child_key is required' });
    }

    const [parentRow, childRow] = await Promise.all([
      db.query(
        `SELECT entity_key, session_id FROM memory_index WHERE entity_key = $1 AND api_key_id = $2 AND deleted_at IS NULL`,
        [parentKey, req.apiKey.id],
      ),
      db.query(
        `SELECT entity_key FROM memory_index WHERE entity_key = $1 AND api_key_id = $2 AND deleted_at IS NULL`,
        [childKey, req.apiKey.id],
      ),
    ]);

    if (parentRow.rowCount === 0) return reply.status(404).send({ error: 'parent memory not found' });
    if (childRow.rowCount === 0) return reply.status(404).send({ error: 'child memory not found' });

    const sessionId: string = parentRow.rows[0].session_id;
    const { entityKey, txHash } = await writeRelationshipEdge({ parentKey, childKey, edgeType, sessionId });

    const expiresAt = new Date(Date.now() + TTL_SECONDS['episodic'] * 1000);
    await db.query(
      `INSERT INTO edge_index (entity_key, api_key_id, parent_key, child_key, edge_type, session_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [entityKey, req.apiKey.id, parentKey, childKey, edgeType, sessionId, expiresAt.toISOString()],
    );

    await db.query(
      `INSERT INTO usage_events (api_key_id, event_type, session_id, entity_key)
       VALUES ($1, 'write', $2, $3)`,
      [req.apiKey.id, sessionId, entityKey],
    );

    return reply.status(201).send({ entity_key: entityKey, tx_hash: txHash, edge_type: edgeType, parent_key: parentKey, child_key: childKey });
  });

  // GET /v1/memories/:key/links — list relationship-edge entities anchored to a memory node
  app.get<{ Params: { key: string } }>('/v1/memories/:key/links', async (req, reply) => {
    const parentKey = req.params.key;

    const parentRow = await db.query(
      `SELECT entity_key FROM memory_index WHERE entity_key = $1 AND api_key_id = $2 AND deleted_at IS NULL`,
      [parentKey, req.apiKey.id],
    );
    if (parentRow.rowCount === 0) return reply.status(404).send({ error: 'memory not found' });

    const rows = await db.query<{
      entity_key: string;
      child_key: string;
      edge_type: string;
      session_id: string;
      created_at: string;
    }>(
      `SELECT entity_key, child_key, edge_type, session_id, created_at
       FROM edge_index
       WHERE parent_key = $1 AND api_key_id = $2 AND deleted_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 50`,
      [parentKey, req.apiKey.id],
    );

    // Also verify on-chain via Arkiv query (uses PROJECT_ATTRIBUTE filter)
    const onChainEdges = await listEdgesByParent(parentKey);
    const onChainKeys = new Set(onChainEdges.map((e) => e.entityKey));

    return reply.send({
      parent_key: parentKey,
      links: rows.rows
        .filter((r) => onChainKeys.has(r.entity_key))
        .map((r) => ({
          entity_key: r.entity_key,
          child_key: r.child_key,
          edge_type: r.edge_type,
          session_id: r.session_id,
          created_at: r.created_at,
        })),
    });
  });

  // POST /v1/memories/recall — query memories in a session (returns all; client filters)
  app.post<{ Body: RecallBody }>('/v1/memories/recall', async (req, reply) => {
    const { session_id, limit = 20 } = req.body;

    if (!session_id) {
      return reply.status(400).send({ error: 'session_id is required' });
    }

    const indexRows = await db.query(
      `SELECT entity_key FROM memory_index
       WHERE session_id = $1 AND api_key_id = $2 AND deleted_at IS NULL AND (pinned = TRUE OR expires_at > NOW())
       ORDER BY pinned DESC, created_at DESC
       LIMIT $3`,
      [session_id, req.apiKey.id, Math.min(limit, 50)],
    );

    const entityKeys: string[] = indexRows.rows.map((r) => r.entity_key);
    if (entityKeys.length === 0) {
      return reply.send({ session_id, memories: [] });
    }

    const memories = await listSessionMemories(session_id);
    const filtered = memories.filter((m) => entityKeys.includes(m.entityKey));

    await db.query(
      `INSERT INTO usage_events (api_key_id, event_type, session_id)
       VALUES ($1, 'recall', $2)`,
      [req.apiKey.id, session_id],
    );

    return reply.send({
      session_id,
      memories: filtered.map((m) => ({
        entity_key: m.entityKey,
        agent_id: m.agentId,
        ciphertext: m.ciphertext,
      })),
    });
  });
}
