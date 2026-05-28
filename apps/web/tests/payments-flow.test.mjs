import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("Stripe Connect payment source checks", () => {
  it("adds Stripe test-mode configuration and provider Connect fields", async () => {
    const stripeLib = await readFile(new URL("../src/app/lib/stripe.ts", import.meta.url), "utf8");
    const database = await readFile(new URL("../src/app/lib/database.ts", import.meta.url), "utf8");
    const providerUi = await readFile(new URL("../src/app/provider/ui.tsx", import.meta.url), "utf8");
    const providerActions = await readFile(new URL("../src/app/provider/actions.ts", import.meta.url), "utf8");

    assert.match(stripeLib, /STRIPE_SECRET_KEY/);
    assert.match(stripeLib, /sk_live_/);
    assert.match(database, /stripe_account_id/);
    assert.match(database, /stripe_charges_enabled/);
    assert.match(database, /stripe_payouts_enabled/);
    assert.match(database, /stripe_onboarding_complete/);
    assert.match(providerUi, /startStripeProviderOnboarding/);
    assert.match(providerActions, /createProviderStripeAccountLink/);
  });

  it("persists service payments and gates acceptance on provider payment readiness", async () => {
    const database = await readFile(new URL("../src/app/lib/database.ts", import.meta.url), "utf8");
    const providerDb = await readFile(new URL("../src/app/provider/db.ts", import.meta.url), "utf8");

    assert.match(database, /CREATE TABLE IF NOT EXISTS service_payments/);
    assert.match(database, /status in \('pending', 'checkout_created', 'paid', 'failed', 'canceled'\)/);
    assert.match(database, /total_amount_cents = service_amount_cents \+ platform_fee_cents \+ sales_tax_cents/);
    assert.match(providerDb, /calculateBookingCharges/);
    assert.match(providerDb, /stripe_required/);
    assert.match(providerDb, /rate_required/);
    assert.match(providerDb, /INSERT INTO service_payments/);
  });

  it("creates Connect Checkout Sessions with destination charges", async () => {
    const paymentsDb = await readFile(new URL("../src/app/payments/db.ts", import.meta.url), "utf8");
    const requestActions = await readFile(new URL("../src/app/requests/actions.ts", import.meta.url), "utf8");
    const requestPage = await readFile(new URL("../src/app/requests/[id]/page.tsx", import.meta.url), "utf8");

    assert.match(paymentsDb, /stripe\.checkout\.sessions\.create/);
    assert.match(paymentsDb, /application_fee_amount: checkout\.platformFeeCents/);
    assert.match(paymentsDb, /transfer_data/);
    assert.match(paymentsDb, /destination: checkout\.stripeConnectedAccountId/);
    assert.match(requestActions, /createBookingCheckoutSession\(requestId, user\.id\)/);
    assert.match(requestPage, /Golden Home Care Service Fee/);
    assert.match(requestPage, /Sales Tax/);
    assert.match(requestPage, /Pay with Stripe/);
  });

  it("handles Stripe webhook and return reconciliation idempotently", async () => {
    const webhook = await readFile(new URL("../src/app/api/stripe/webhook/route.ts", import.meta.url), "utf8");
    const paymentsDb = await readFile(new URL("../src/app/payments/db.ts", import.meta.url), "utf8");
    const returnPage = await readFile(
      new URL("../src/app/payments/stripe/return/page.tsx", import.meta.url),
      "utf8",
    );

    assert.match(webhook, /await req\.text\(\)/);
    assert.match(webhook, /constructEvent\(body, signature, getStripeWebhookSecret\(\)\)/);
    assert.match(webhook, /checkout\.session\.completed/);
    assert.match(webhook, /account\.updated/);
    assert.match(paymentsDb, /export async function markCheckoutSessionPaid/);
    assert.match(paymentsDb, /status = 'paid'/);
    assert.match(paymentsDb, /WHERE id = \$3/);
    assert.match(returnPage, /reconcileCheckoutSessionForRequester\(sessionId, user\.id\)/);
  });
});
