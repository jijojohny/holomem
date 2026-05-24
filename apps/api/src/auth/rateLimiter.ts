import type { FastifyInstance } from 'fastify';
import { db } from '../db/pool.js';
import type { Tier } from './apiKeys.js';

const MONTHLY_WRITE_LIMITS: Record<Tier, number> = {
  free: 1_000,
  pro: 50_000,
  team: 500_000,
  enterprise: Infinity,
};

export function registerRateLimiter(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    // Only rate-limit write operations; auth hook runs first so req.apiKey is set
    if (!req.apiKey || req.method !== 'POST' || !req.url.startsWith('/v1/memories')) return;
    if (req.url === '/v1/memories/recall') return; // reads don't count against write quota

    const limit = MONTHLY_WRITE_LIMITS[req.apiKey.tier];
    if (limit === Infinity) return;

    // For team keys, pool quota across all keys in the same team
    const teamRow = await db.query<{ team_id: string | null }>(
      `SELECT team_id FROM api_keys WHERE id = $1`,
      [req.apiKey.id],
    );
    const teamId = teamRow.rows[0]?.team_id;

    let used: number;
    if (teamId) {
      const result = await db.query<{ count: string }>(
        `SELECT COUNT(*) AS count
         FROM usage_events ue
         JOIN api_keys ak ON ak.id = ue.api_key_id
         WHERE ak.team_id = $1
           AND ue.event_type = 'write'
           AND ue.created_at >= date_trunc('month', NOW())`,
        [teamId],
      );
      used = parseInt(result.rows[0].count, 10);
    } else {
      const result = await db.query<{ count: string }>(
        `SELECT COUNT(*) AS count
         FROM usage_events
         WHERE api_key_id = $1
           AND event_type = 'write'
           AND created_at >= date_trunc('month', NOW())`,
        [req.apiKey.id],
      );
      used = parseInt(result.rows[0].count, 10);
    }

    if (used >= limit) {
      return reply.status(429).send({
        error: 'Monthly write quota exceeded',
        used,
        limit,
        tier: req.apiKey.tier,
        resets_at: 'first of next month',
      });
    }
  });
}
