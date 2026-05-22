import type { FastifyInstance } from 'fastify';
import { db } from '../db/pool.js';
import { createApiKey } from '../auth/apiKeys.js';

export async function authRoutes(app: FastifyInstance) {
  // POST /v1/auth/google — verify a Google ID token and issue an API key
  app.post<{ Body: { credential: string } }>('/v1/auth/google', async (req, reply) => {
    const { credential } = req.body ?? {};
    if (!credential || typeof credential !== 'string') {
      return reply.status(400).send({ error: 'credential is required' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return reply.status(503).send({ error: 'Google auth is not configured on this server' });
    }

    // Verify the credential with Google's tokeninfo endpoint
    const googleRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
    );
    const info = await googleRes.json() as Record<string, string>;

    if (!googleRes.ok) {
      return reply.status(401).send({ error: 'Google token verification failed' });
    }
    if (info.aud !== clientId) {
      return reply.status(401).send({ error: 'Token was issued for a different application' });
    }
    if (info.email_verified !== 'true') {
      return reply.status(401).send({ error: 'Google account email is not verified' });
    }

    const email = info.email?.toLowerCase().trim();
    if (!email) {
      return reply.status(401).send({ error: 'Could not read email from Google token' });
    }

    // Upsert customer
    const customerResult = await db.query<{ id: string }>(
      `INSERT INTO customers (email)
       VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [email],
    );
    const customerId = customerResult.rows[0].id;

    // Issue a new live key — old keys remain active until manually revoked
    const rawKey = await createApiKey(customerId, 'live');

    return reply.status(201).send({ api_key: rawKey, email });
  });
}
