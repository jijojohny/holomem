import './types.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { verifyApiKey } from './auth/apiKeys.js';
import { registerRateLimiter } from './auth/rateLimiter.js';
import { memoriesRoutes } from './routes/memories.js';
import { keysRoutes } from './routes/keys.js';
import { usageRoutes } from './routes/usage.js';
import { sessionsRoutes } from './routes/sessions.js';
import { billingRoutes } from './routes/billing.js';
import { webhooksRoutes } from './routes/webhooks.js';
import { authRoutes } from './routes/auth.js';
import { teamsRoutes } from './routes/teams.js';

export function buildApp() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

  app.register(cors, { origin: process.env.CORS_ORIGIN ?? '*' });
  app.register(helmet);

  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/v1/')) return;
    if (req.method === 'POST' && req.url === '/v1/auth/google') return;

    const auth = req.headers.authorization;

    if (req.method === 'POST' && req.url === '/v1/keys') {
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

  app.register(memoriesRoutes);
  app.register(keysRoutes);
  app.register(usageRoutes);
  app.register(sessionsRoutes);
  app.register(billingRoutes);
  app.register(webhooksRoutes);
  app.register(authRoutes);
  app.register(teamsRoutes);

  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  return app;
}
