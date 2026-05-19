import type { ApiKeyRecord } from './auth/apiKeys.js';

declare module 'fastify' {
  interface FastifyRequest {
    apiKey: ApiKeyRecord;
  }
}
