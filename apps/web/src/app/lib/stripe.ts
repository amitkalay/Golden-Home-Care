import Stripe from "stripe";

const STRIPE_API_VERSION = "2026-05-27.dahlia";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  if (secretKey.startsWith("sk_live_")) {
    throw new Error("Live Stripe keys are disabled for the current test-mode payments phase.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
    });
  }

  return stripeClient;
}

export function getStripeWebhookSecret() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  }

  return webhookSecret;
}
