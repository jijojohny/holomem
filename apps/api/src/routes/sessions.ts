import type { FastifyInstance } from 'fastify';
import { db } from '../db/pool.js';
import {
  getAgentSession, listSessionMemories, listSessionEdges,
  writeAgentSession,
} from '../arkiv.js';
import { poolWalletAddress } from '../wallet-pool/index.js';
import '../types.js';

interface SessionRow {
  session_id: string;
  memory_count: string;
  last_activity: string;
  session_entity_key: string | null;
  session_creator: string | null;
}

export async function sessionsRoutes(app: FastifyInstance) {
  // POST /v1/sessions — explicitly create a named agent-session entity on Arkiv
  app.post<{ Body: { session_id: string; agent_id?: string } }>('/v1/sessions', async (req, reply) => {
    const { session_id, agent_id = 'sdk' } = req.body;
    if (!session_id || typeof session_id !== 'string') {
      return reply.status(400).send({ error: 'session_id is required' });
    }

    const existing = await db.query(
      `SELECT entity_key FROM session_index WHERE session_id = $1 AND api_key_id = $2`,
      [session_id, req.apiKey.id],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      return reply.send({
        entity_key: existing.rows[0].entity_key,
        session_id,
        created: false,
        message: 'Session already exists',
      });
    }

    const { entityKey, txHash } = await writeAgentSession({ sessionId: session_id, agentId: agent_id });
    await db.query(
      `INSERT INTO session_index (entity_key, api_key_id, session_id, agent_id, creator)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (api_key_id, session_id) DO NOTHING`,
      [entityKey, req.apiKey.id, session_id, agent_id, poolWalletAddress],
    );

    return reply.status(201).send({ entity_key: entityKey, tx_hash: txHash, session_id, created: true });
  });

  // GET /v1/sessions — list unique sessions for the authenticated key, newest first
  app.get('/v1/sessions', async (req, reply) => {
    const result = await db.query<SessionRow>(
      `SELECT
         mi.session_id,
         COUNT(*)              AS memory_count,
         MAX(mi.created_at)   AS last_activity,
         si.entity_key        AS session_entity_key,
         si.creator           AS session_creator
       FROM memory_index mi
       LEFT JOIN session_index si
         ON si.session_id = mi.session_id AND si.api_key_id = mi.api_key_id
       WHERE mi.api_key_id = $1
         AND mi.deleted_at IS NULL
         AND (mi.pinned = TRUE OR mi.expires_at > NOW())
       GROUP BY mi.session_id, si.entity_key, si.creator
       ORDER BY last_activity DESC
       LIMIT 50`,
      [req.apiKey.id],
    );

    return reply.send({
      sessions: result.rows.map((r) => ({
        session_id: r.session_id,
        memory_count: parseInt(r.memory_count, 10),
        last_activity: r.last_activity,
        session_entity_key: r.session_entity_key ?? null,
        creator: r.session_creator ?? null,
      })),
    });
  });

  // GET /v1/sessions/:id — get a single session with entity metadata
  app.get<{ Params: { id: string } }>('/v1/sessions/:id', async (req, reply) => {
    const sessionId = decodeURIComponent(req.params.id);

    const indexRow = await db.query<SessionRow>(
      `SELECT
         mi.session_id,
         COUNT(*)              AS memory_count,
         MAX(mi.created_at)   AS last_activity,
         si.entity_key        AS session_entity_key,
         si.creator           AS session_creator
       FROM memory_index mi
       LEFT JOIN session_index si
         ON si.session_id = mi.session_id AND si.api_key_id = mi.api_key_id
       WHERE mi.api_key_id = $1 AND mi.session_id = $2
         AND mi.deleted_at IS NULL
       GROUP BY mi.session_id, si.entity_key, si.creator`,
      [req.apiKey.id, sessionId],
    );

    if (!indexRow.rowCount) {
      return reply.status(404).send({ error: 'session not found' });
    }

    const r = indexRow.rows[0];

    // Check Arkiv for the agent-session entity (live on-chain lookup)
    const sessionEntity = await getAgentSession(sessionId);

    return reply.send({
      session_id: sessionId,
      memory_count: parseInt(r.memory_count, 10),
      last_activity: r.last_activity,
      entity: sessionEntity
        ? {
            entity_key: sessionEntity.entityKey,
            agent_id: sessionEntity.agentId,
            creator: sessionEntity.creator,
            type: 'agent-session',
          }
        : r.session_entity_key
          ? { entity_key: r.session_entity_key, creator: r.session_creator, type: 'agent-session' }
          : null,
    });
  });

  // GET /v1/sessions/:id/graph — full on-chain graph: agent-session + memory-nodes + relationship-edges
  app.get<{ Params: { id: string } }>('/v1/sessions/:id/graph', async (req, reply) => {
    const sessionId = decodeURIComponent(req.params.id);

    // Verify this session belongs to the authenticated key — check both tables
    // (session may exist without memories if created via POST /v1/sessions)
    const accessCheck = await db.query(
      `SELECT 1 FROM session_index WHERE session_id = $1 AND api_key_id = $2
       UNION ALL
       SELECT 1 FROM memory_index WHERE session_id = $1 AND api_key_id = $2 LIMIT 1`,
      [sessionId, req.apiKey.id],
    );
    if (!accessCheck.rowCount) {
      return reply.status(404).send({ error: 'session not found' });
    }

    // Query all three entity types from Arkiv in parallel (each uses PROJECT_ATTRIBUTE filter)
    const [sessionEntity, memoryNodes, edges] = await Promise.all([
      getAgentSession(sessionId),
      listSessionMemories(sessionId),
      listSessionEdges(sessionId),
    ]);

    return reply.send({
      session: sessionEntity
        ? {
            entity_key: sessionEntity.entityKey,
            session_id: sessionEntity.sessionId,
            agent_id: sessionEntity.agentId,
            creator: sessionEntity.creator,
            type: 'agent-session',
          }
        : null,
      nodes: memoryNodes.map((m) => ({
        entity_key: m.entityKey,
        agent_id: m.agentId,
        session_id: m.sessionId,
        creator: m.creator,
        type: 'memory-node',
      })),
      edges: edges.map((e) => ({
        entity_key: e.entityKey,
        parent_key: e.parentKey,
        child_key: e.childKey,
        edge_type: e.edgeType,
        session_id: e.sessionId,
        type: 'relationship-edge',
      })),
      meta: {
        project_attribute: 'HOLOMEM_SYSTEM_PROD',
        entity_types: ['agent-session', 'memory-node', 'relationship-edge'],
        total: (sessionEntity ? 1 : 0) + memoryNodes.length + edges.length,
      },
    });
  });

  // DELETE /v1/sessions/:id — bulk soft-delete all memories in a session
  app.delete<{ Params: { id: string } }>('/v1/sessions/:id', async (req, reply) => {
    const sessionId = decodeURIComponent(req.params.id);

    const result = await db.query<{ entity_key: string }>(
      `WITH deleted AS (
         UPDATE memory_index
         SET deleted_at = NOW()
         WHERE session_id = $1 AND api_key_id = $2 AND deleted_at IS NULL
         RETURNING entity_key
       )
       INSERT INTO usage_events (api_key_id, event_type, session_id, entity_key)
       SELECT $2, 'delete', $1, entity_key FROM deleted
       RETURNING entity_key`,
      [sessionId, req.apiKey.id],
    );

    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'session not found or already deleted' });
    }

    return reply.send({ deleted: result.rowCount });
  });
}
