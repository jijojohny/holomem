import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');

async function migrate() {
  console.log('[migrate] applying schema...');
  await db.query(schema);
  console.log('[migrate] done');
  await db.end();
}

migrate().catch((err) => {
  console.error('[migrate] failed:', err.message);
  process.exit(1);
});
