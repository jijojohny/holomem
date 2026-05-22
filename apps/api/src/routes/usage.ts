import type { FastifyInstance } from 'fastify';
import { db } from '../db/pool.js';
import '../types.js';

const MONTHLY_WRITE_LIMITS: Record<string, number> = {
  free: 1_000,
  pro: 50_000,
  team: 500_000,
  enterprise: -1, // unlimited
};

export async function usageRoutes(app: FastifyInstance) {
  // GET /v1/usage — current billing period usage for the authenticated key
  app.get('/v1/usage', async (req, reply) => {
    const keyId = req.apiKey.id;
    const tier = req.apiKey.tier;

    const [writesRow, readsRow, memoriesRow] = await Promise.all([
      db.query<{ used: string }>(
        `SELECT COUNT(*) AS used
         FROM usage_events
         WHERE api_key_id = $1
           AND event_type = 'write'
           AND created_at >= date_trunc('month', NOW())`,
        [keyId],
      ),
      db.query<{ used: string }>(
        `SELECT COUNT(*) AS used
         FROM usage_events
         WHERE api_key_id = $1
           AND event_type IN ('read', 'recall')
           AND created_at >= date_trunc('month', NOW())`,
        [keyId],
      ),
      db.query<{ active: string }>(
        `SELECT COUNT(*) AS active
         FROM memory_index
         WHERE api_key_id = $1
           AND deleted_at IS NULL
           AND expires_at > NOW()`,
        [keyId],
      ),
    ]);

    const writesUsed = parseInt(writesRow.rows[0].used, 10);
    const readsUsed = parseInt(readsRow.rows[0].used, 10);
    const activeMemories = parseInt(memoriesRow.rows[0].active, 10);

    const limit = MONTHLY_WRITE_LIMITS[tier];
    const now = new Date();
    const resetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();

    return reply.send({
      tier,
      writes: {
        used: writesUsed,
        limit: limit === -1 ? null : limit,
        remaining: limit === -1 ? null : Math.max(0, limit - writesUsed),
        resets_at: resetsAt,
      },
      reads: {
        this_month: readsUsed,
      },
      memories: {
        active: activeMemories,
      },
    });
  });

  // GET /v1/usage/history — daily write counts for the last 7 days
  app.get('/v1/usage/history', async (req, reply) => {
    const rows = await db.query<{ day: string; writes: string }>(
      `SELECT DATE_TRUNC('day', created_at AT TIME ZONE 'UTC')::DATE::TEXT AS day,
              COUNT(*) AS writes
       FROM usage_events
       WHERE api_key_id = $1
         AND event_type = 'write'
         AND created_at >= NOW() - INTERVAL '7 days'
       GROUP BY day
       ORDER BY day`,
      [req.apiKey.id],
    );

    // Fill in zeros for days with no writes
    const days: { day: string; writes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      const found = rows.rows.find((r) => r.day === key);
      days.push({ day: key, writes: found ? parseInt(found.writes, 10) : 0 });
    }

    return reply.send({ days });
  });

  // GET /v1/activity — last N API events for the authenticated key
  app.get<{ Querystring: { limit?: string } }>('/v1/activity', async (req, reply) => {
    const limit = Math.min(parseInt(req.query.limit ?? '20', 10), 50);
    const rows = await db.query<{
      event_type: string; session_id: string | null; entity_key: string | null; created_at: string;
    }>(
      `SELECT event_type, session_id, entity_key, created_at
       FROM usage_events
       WHERE api_key_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.apiKey.id, limit],
    );
    return reply.send({ events: rows.rows });
  });
}
