import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY;

export const stripe = secret
  ? new Stripe(secret, { apiVersion: '2025-02-24.acacia' })
  : null;

export const PRICE_IDS: Record<string, string | undefined> = {
  pro: process.env.STRIPE_PRO_PRICE_ID,
  team: process.env.STRIPE_TEAM_PRICE_ID,
};

export const TIER_LABELS: Record<string, string> = {
  pro: 'Pro — $49/mo',
  team: 'Team — $199/mo',
};
