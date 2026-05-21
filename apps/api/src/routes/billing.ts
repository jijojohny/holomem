import type { FastifyInstance, FastifyReply } from 'fastify';
import { stripe, PRICE_IDS } from '../billing/stripe.js';
import { db } from '../db/pool.js';
import '../types.js';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

function noStripe(reply: FastifyReply) {
  return reply.status(503).send({ error: 'Stripe is not configured on this server' });
}

export async function billingRoutes(app: FastifyInstance) {
  // POST /v1/billing/checkout — create a Stripe Checkout session, returns redirect URL
  app.post<{ Body: { tier: string } }>('/v1/billing/checkout', async (req, reply) => {
    if (!stripe) return noStripe(reply);

    const { tier } = req.body ?? {};
    const priceId = PRICE_IDS[tier];
    if (!priceId) {
      return reply.status(400).send({ error: `Invalid tier. Must be one of: ${Object.keys(PRICE_IDS).join(', ')}` });
    }

    const customerRow = await db.query<{ id: string; email: string; stripe_customer_id: string | null }>(
      `SELECT c.id, c.email, c.stripe_customer_id
       FROM customers c
       JOIN api_keys k ON k.customer_id = c.id
       WHERE k.id = $1`,
      [req.apiKey.id],
    );
    if (customerRow.rowCount === 0) {
      return reply.status(404).send({ error: 'Customer not found' });
    }

    const customer = customerRow.rows[0];
    let stripeCustomerId = customer.stripe_customer_id;

    if (!stripeCustomerId) {
      const sc = await stripe.customers.create({
        email: customer.email,
        metadata: { holomem_customer_id: customer.id },
      });
      stripeCustomerId = sc.id;
      await db.query(`UPDATE customers SET stripe_customer_id = $1 WHERE id = $2`, [stripeCustomerId, customer.id]);
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/billing`,
      metadata: { holomem_api_key_id: req.apiKey.id, tier },
    });

    return reply.send({ checkout_url: session.url });
  });

  // GET /v1/billing/portal — Stripe customer portal link
  app.get('/v1/billing/portal', async (req, reply) => {
    if (!stripe) return noStripe(reply);

    const customerRow = await db.query<{ stripe_customer_id: string | null }>(
      `SELECT c.stripe_customer_id
       FROM customers c
       JOIN api_keys k ON k.customer_id = c.id
       WHERE k.id = $1`,
      [req.apiKey.id],
    );

    const stripeCustomerId = customerRow.rows[0]?.stripe_customer_id;
    if (!stripeCustomerId) {
      return reply.status(404).send({ error: 'No billing account found. Upgrade first.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${APP_URL}/billing`,
    });

    return reply.send({ portal_url: session.url });
  });

  // POST /v1/billing/webhook — Stripe event handler (raw body for signature verification)
  app.register(async function webhookScope(scope) {
    scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));

    scope.post('/v1/billing/webhook', async (req, reply) => {
      if (!stripe) return reply.status(503).send({ error: 'Stripe not configured' });

      const sig = req.headers['stripe-signature'] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) return reply.status(503).send({ error: 'Webhook secret not configured' });

      let event: import('stripe').Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.status(400).send({ error: `Webhook signature verification failed: ${msg}` });
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as import('stripe').Stripe.Checkout.Session;
        const apiKeyId = session.metadata?.holomem_api_key_id;
        const tier = session.metadata?.tier;
        if (apiKeyId && tier) {
          await db.query(`UPDATE api_keys SET tier = $1 WHERE id = $2`, [tier, apiKeyId]);
        }
      }

      if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object as import('stripe').Stripe.Subscription;
        const stripeCustomerId = sub.customer as string;
        await db.query(
          `UPDATE api_keys k SET tier = 'free'
           FROM customers c
           WHERE k.customer_id = c.id AND c.stripe_customer_id = $1`,
          [stripeCustomerId],
        );
      }

      return reply.send({ received: true });
    });
  });
}
