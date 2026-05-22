import { db } from './db/pool.js';

export async function deliverWebhooks(
  apiKeyId: string,
  eventType: string,
  data: Record<string, unknown>,
) {
  const rows = await db.query<{ id: string; url: string }>(
    `SELECT id, url FROM webhooks WHERE api_key_id = $1 AND active = TRUE AND $2 = ANY(events)`,
    [apiKeyId, eventType],
  );
  if (rows.rowCount === 0) return;

  const payload = JSON.stringify({ event: eventType, data, timestamp: new Date().toISOString() });

  for (const webhook of rows.rows) {
    (async () => {
      try {
        const res = await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-HoloMem-Event': eventType },
          body: payload,
          signal: AbortSignal.timeout(10_000),
        });
        await db.query(
          `INSERT INTO webhook_deliveries (webhook_id, event_type, status_code) VALUES ($1, $2, $3)`,
          [webhook.id, eventType, res.status],
        );
      } catch (err) {
        await db.query(
          `INSERT INTO webhook_deliveries (webhook_id, event_type, error) VALUES ($1, $2, $3)`,
          [webhook.id, eventType, err instanceof Error ? err.message : String(err)],
        );
      }
    })();
  }
}
