import type { FastifyInstance } from 'fastify';
import { db } from '../db/pool.js';
import '../types.js';

interface SessionRow {
  session_id: string;
  memory_count: string;
  last_activity: string;
}

export async function sessionsRoutes(app: FastifyInstance) {
  // GET /v1/sessions — list unique sessions for the authenticated key, newest first
  app.get('/v1/sessions', async (req, reply) => {
    const result = await db.query<SessionRow>(
      `SELECT session_id,
              COUNT(*)        AS memory_count,
              MAX(created_at) AS last_activity
       FROM memory_index
       WHERE api_key_id = $1
         AND deleted_at IS NULL
         AND expires_at > NOW()
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
