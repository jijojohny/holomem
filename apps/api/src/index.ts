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

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

await app.register(cors, { origin: process.env.CORS_ORIGIN ?? false });
await app.register(helmet);

// Auth middleware — every /v1/ route except POST /v1/keys (sign-up) requires a Bearer key
app.addHook('onRequest', async (req, reply) => {
  if (!req.url.startsWith('/v1/')) return;
  if (req.method === 'POST' && req.url === '/v1/keys') return; // public sign-up

  const auth = req.headers.authorization;
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
