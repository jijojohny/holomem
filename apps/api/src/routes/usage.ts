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
}
