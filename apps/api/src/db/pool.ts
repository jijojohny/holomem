import pg from 'pg';

const { Pool } = pg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

db.on('error', (err) => {
  console.error('[db] unexpected pool error:', err.message);
});
