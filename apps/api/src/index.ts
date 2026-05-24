import 'dotenv/config';
import { buildApp } from './app.js';
import { db } from './db/pool.js';

const app = buildApp();

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
