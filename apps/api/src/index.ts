import 'dotenv/config';
import './types.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { db } from './db/pool.js';
import { verifyApiKey } from './auth/apiKeys.js';
import { registerRateLimiter } from './auth/rateLimiter.js';
import { memoriesRoutes } from './routes/memories.js';
import { keysRoutes } from './routes/keys.js';
import { usageRoutes } from './routes/usage.js';
import { sessionsRoutes } from './routes/sessions.js';
import { billingRoutes } from './routes/billing.js';
import { webhooksRoutes } from './routes/webhooks.js';
import { authRoutes } from './routes/auth.js';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

await app.register(cors, { origin: process.env.CORS_ORIGIN ?? false });
await app.register(helmet);

// Auth middleware
// - POST /v1/auth/google  → no auth required
// - POST /v1/keys         → optional auth: if a valid Bearer token is present, populate
//                           req.apiKey so the route can create a key for that customer
//                           without requiring an email body (dashboard flow).
//                           If no token, fall through to the unauthenticated signup path.
// - All other /v1/ routes → auth required
app.addHook('onRequest', async (req, reply) => {
  if (!req.url.startsWith('/v1/')) return;
  if (req.method === 'POST' && req.url === '/v1/auth/google') return;

  const auth = req.headers.authorization;

  if (req.method === 'POST' && req.url === '/v1/keys') {
    // Optional auth — try to identify the caller but don't reject if absent
    if (auth?.startsWith('Bearer ')) {
      const apiKey = await verifyApiKey(auth.slice(7).trim());
      if (apiKey) req.apiKey = apiKey;
    }
    return;
  }

  if (!auth?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
  }

  const rawKey = auth.slice(7).trim();
  const apiKey = await verifyApiKey(rawKey);
  if (!apiKey) {
    return reply.status(401).send({ error: 'Invalid or revoked API key' });
  }

  req.apiKey = apiKey;
});

registerRateLimiter(app);

await app.register(memoriesRoutes);
await app.register(keysRoutes);
await app.register(usageRoutes);
await app.register(sessionsRoutes);
await app.register(billingRoutes);
await app.register(webhooksRoutes);
await app.register(authRoutes);

app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

const port = parseInt(process.env.PORT ?? '3001', 10);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  console.log(`[api] listening on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  await db.end();
  process.exit(1);
}
