import type { FastifyInstance } from 'fastify';
import { db } from '../db/pool.js';
import '../types.js';

interface SessionRow {
  session_id: string;
  memory_count: string;
  last_activity: string;
}

export async function sessionsRoutes(app: FastifyInstance) {
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

  // GET /v1/sessions — list unique sessions for the authenticated key, newest first
  app.get('/v1/sessions', async (req, reply) => {
    const result = await db.query<SessionRow>(
      `SELECT session_id,
              COUNT(*)        AS memory_count,
              MAX(created_at) AS last_activity
       FROM memory_index
       WHERE api_key_id = $1
         AND deleted_at IS NULL
         AND (pinned = TRUE OR expires_at > NOW())
       GROUP BY session_id
       ORDER BY last_activity DESC
       LIMIT 50`,
      [req.apiKey.id],
    );

    return reply.send({
      sessions: result.rows.map((r) => ({
        session_id: r.session_id,
        memory_count: parseInt(r.memory_count, 10),
        last_activity: r.last_activity,
      })),
    });
  });
}
