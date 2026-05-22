import type { FastifyInstance } from 'fastify';
import { db } from '../db/pool.js';
import '../types.js';

const VALID_EVENTS = ['write', 'read', 'delete', 'recall'] as const;

interface CreateBody {
  url: string;
  events?: string[];
}

export async function webhooksRoutes(app: FastifyInstance) {
  // GET /v1/webhooks — list all webhooks for the authenticated key
  app.get('/v1/webhooks', async (req, reply) => {
    const rows = await db.query<{
      id: string; url: string; events: string[]; active: boolean; created_at: string;
      last_status: number | null; last_delivered_at: string | null;
    }>(
      `SELECT w.id, w.url, w.events, w.active, w.created_at,
              d.status_code AS last_status, d.created_at AS last_delivered_at
       FROM webhooks w
       LEFT JOIN LATERAL (
         SELECT status_code, created_at FROM webhook_deliveries
         WHERE webhook_id = w.id ORDER BY created_at DESC LIMIT 1
       ) d ON TRUE
       WHERE w.api_key_id = $1
       ORDER BY w.created_at DESC`,
      [req.apiKey.id],
    );
    return reply.send({ webhooks: rows.rows });
  });

  // POST /v1/webhooks — register a new webhook
  app.post<{ Body: CreateBody }>('/v1/webhooks', async (req, reply) => {
    const { url, events = ['write', 'delete'] } = req.body ?? {};

    if (!url || typeof url !== 'string') {
      return reply.status(400).send({ error: 'url is required' });
    }
    try { new URL(url); } catch {
      return reply.status(400).send({ error: 'url must be a valid URL' });
    }
    const invalid = events.filter((e) => !VALID_EVENTS.includes(e as typeof VALID_EVENTS[number]));
    if (invalid.length) {
      return reply.status(400).send({ error: `invalid events: ${invalid.join(', ')}` });
    }

    const existing = await db.query(
      `SELECT id FROM webhooks WHERE api_key_id = $1`,
      [req.apiKey.id],
    );
    if ((existing.rowCount ?? 0) >= 10) {
      return reply.status(400).send({ error: 'Maximum of 10 webhooks per key' });
    }

    const row = await db.query<{ id: string; created_at: string }>(
      `INSERT INTO webhooks (api_key_id, url, events)
       VALUES ($1, $2, $3::TEXT[])
       RETURNING id, created_at`,
      [req.apiKey.id, url, events],
    );
    return reply.status(201).send({ id: row.rows[0].id, url, events, created_at: row.rows[0].created_at });
  });

  // DELETE /v1/webhooks/:id
  app.delete<{ Params: { id: string } }>('/v1/webhooks/:id', async (req, reply) => {
    const result = await db.query(
      `DELETE FROM webhooks WHERE id = $1 AND api_key_id = $2 RETURNING id`,
      [req.params.id, req.apiKey.id],
    );
    if (result.rowCount === 0) return reply.status(404).send({ error: 'webhook not found' });
    return reply.status(204).send();
  });

  // POST /v1/webhooks/:id/test — fire a test ping to the endpoint
  app.post<{ Params: { id: string } }>('/v1/webhooks/:id/test', async (req, reply) => {
    const row = await db.query<{ id: string; url: string }>(
      `SELECT id, url FROM webhooks WHERE id = $1 AND api_key_id = $2 AND active = TRUE`,
      [req.params.id, req.apiKey.id],
    );
    if (row.rowCount === 0) return reply.status(404).send({ error: 'webhook not found' });

    const { id, url } = row.rows[0];
    const payload = JSON.stringify({
      event: 'test',
      data: { message: 'HoloMem webhook test ping' },
      timestamp: new Date().toISOString(),
    });

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-HoloMem-Event': 'test' },
        body: payload,
        signal: AbortSignal.timeout(10_000),
      });
      await db.query(
        `INSERT INTO webhook_deliveries (webhook_id, event_type, status_code) VALUES ($1, 'test', $2)`,
        [id, res.status],
      );
      return reply.send({ ok: res.ok, status: res.status });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db.query(
        `INSERT INTO webhook_deliveries (webhook_id, event_type, error) VALUES ($1, 'test', $2)`,
        [id, msg],
      );
      return reply.status(502).send({ error: `Delivery failed: ${msg}` });
    }
  });

  // GET /v1/webhooks/:id/deliveries — last 20 deliveries for a webhook
  app.get<{ Params: { id: string } }>('/v1/webhooks/:id/deliveries', async (req, reply) => {
    const owns = await db.query(
      `SELECT id FROM webhooks WHERE id = $1 AND api_key_id = $2`,
      [req.params.id, req.apiKey.id],
    );
    if (owns.rowCount === 0) return reply.status(404).send({ error: 'webhook not found' });

    const rows = await db.query(
      `SELECT id, event_type, status_code, error, created_at
       FROM webhook_deliveries WHERE webhook_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [req.params.id],
    );
    return reply.send({ deliveries: rows.rows });
  });
}
