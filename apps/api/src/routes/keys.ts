import type { FastifyInstance } from 'fastify';
import { db } from '../db/pool.js';
import { createApiKey, revokeApiKey, type ApiKeyEnv } from '../auth/apiKeys.js';

interface IssueKeyBody {
  email: string;
  env?: ApiKeyEnv;
}

export async function keysRoutes(app: FastifyInstance) {
  // POST /v1/keys — sign up and receive an API key (no auth required)
  // Idempotent: calling twice with the same email issues a second key for the same customer
  app.post<{ Body: IssueKeyBody }>('/v1/keys', async (req, reply) => {
    const { email, env = 'live' } = req.body ?? {};

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return reply.status(400).send({ error: 'valid email is required' });
    }
    if (env !== 'live' && env !== 'test') {
      return reply.status(400).send({ error: "env must be 'live' or 'test'" });
    }

    // Upsert customer
    const customerResult = await db.query<{ id: string }>(
      `INSERT INTO customers (email)
       VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [email.toLowerCase().trim()],
    );
    const customerId = customerResult.rows[0].id;

    const rawKey = await createApiKey(customerId, env);

    return reply.status(201).send({
      api_key: rawKey,
      env,
      note: 'Store this key — it is shown only once.',
    });
  });

  // GET /v1/keys — list keys for the authenticated customer (auth required)
  app.get('/v1/keys', async (req, reply) => {
    if (!req.apiKey) {
      return reply.status(401).send({ error: 'Authorization required' });
    }

    const result = await db.query<{
      id: string;
      key_prefix: string;
      env: string;
      tier: string;
      created_at: string;
      revoked_at: string | null;
    }>(
      `SELECT id, key_prefix, env, tier, created_at, revoked_at
       FROM api_keys
       WHERE customer_id = $1
       ORDER BY created_at DESC`,
      [req.apiKey.customer_id],
    );

    return reply.send({
      keys: result.rows.map((r) => ({
        id: r.id,
        prefix: r.key_prefix,
        env: r.env,
        tier: r.tier,
        created_at: r.created_at,
        active: r.revoked_at === null,
      })),
    });
  });

  // DELETE /v1/keys/:id — revoke a key (must belong to the same customer)
  app.delete<{ Params: { id: string } }>('/v1/keys/:id', async (req, reply) => {
    if (!req.apiKey) {
      return reply.status(401).send({ error: 'Authorization required' });
    }

    const { id } = req.params;
    const result = await db.query(
      `SELECT id FROM api_keys
       WHERE id = $1 AND customer_id = $2 AND revoked_at IS NULL`,
      [id, req.apiKey.customer_id],
    );

    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'key not found or already revoked' });
    }

    await revokeApiKey(id);
    return reply.status(204).send();
  });
}
