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

  it("adds an account payments hub without client-side card collection", async () => {
    const paymentsPage = await readFile(
      new URL("../src/app/account/payments/page.tsx", import.meta.url),
      "utf8",
    );
    const accountPaymentsActions = await readFile(
      new URL("../src/app/account/payments/actions.ts", import.meta.url),
      "utf8",
    );
    const stripeErrors = await readFile(new URL("../src/app/payments/stripe-errors.ts", import.meta.url), "utf8");
    const paymentsDb = await readFile(new URL("../src/app/payments/db.ts", import.meta.url), "utf8");
    const accountPage = await readFile(new URL("../src/app/account/page.tsx", import.meta.url), "utf8");
    const accountRequestsPage = await readFile(
      new URL("../src/app/account/requests/page.tsx", import.meta.url),
      "utf8",
    );
    const providerUi = await readFile(new URL("../src/app/provider/ui.tsx", import.meta.url), "utf8");

    assert.match(paymentsPage, /Requester payments/);
    assert.match(paymentsPage, /Provider payouts/);
    assert.match(paymentsPage, /payForServiceRequest/);
    assert.match(paymentsPage, /stripeRequirementsCurrentlyDue/);
    assert.match(paymentsPage, /\[\.\.\.new Set\(profile\?\.stripeRequirementsCurrentlyDue \?\? \[\]\)\]/);
    assert.match(paymentsPage, /Stripe Connect is not enabled/);
    assert.match(accountPaymentsActions, /startAccountStripeProviderOnboarding/);
    assert.match(accountPaymentsActions, /ensureDraftProviderProfile/);
    assert.match(accountPaymentsActions, /getStripeConnectSetupStatus/);
    assert.match(accountPaymentsActions, /baseUrl: await getCurrentRequestBaseUrl\(\)/);
    assert.match(accountPaymentsActions, /returnPath: "\/account\/payments\?stripe=returned"/);
    assert.match(
      accountPaymentsActions,
      /refreshPath: "\/payments\/stripe\/connect\/refresh\?destination=account"/,
    );
    assert.doesNotMatch(accountPaymentsActions, /refreshPath: "\/account\/payments\?stripe=refresh"/);
    assert.match(paymentsDb, /baseUrl\?: string/);
    assert.match(paymentsDb, /returnPath \?\? "\/provider\?stripe=returned"/);
    assert.match(
      paymentsDb,
      /options\.refreshPath \?\? "\/payments\/stripe\/connect\/refresh\?destination=provider"/,
    );
    assert.doesNotMatch(paymentsDb, /refreshPath \?\? "\/provider\?stripe=refresh"/);
    assert.match(accountPage, /\/account\/payments/);
    assert.match(accountRequestsPage, /\/account\/payments/);
    assert.match(providerUi, /\/account\/payments/);
    assert.match(stripeErrors, /signed up for Connect/);
    assert.match(stripeErrors, /connect-disabled/);
    assert.match(paymentsDb, /function uniqueRequirements/);
    assert.match(paymentsDb, /stripeRequirementsCurrentlyDue: uniqueRequirements/);
    assert.doesNotMatch(paymentsPage, /NEXT_STRIPE_PUBLISHABLE_KEY|Stripe Elements|saved card/i);
    assert.doesNotMatch(accountPaymentsActions, /NEXT_STRIPE_PUBLISHABLE_KEY/);
  });

  it("regenerates expired Connect onboarding links through a refresh route", async () => {
    const connectRefreshRoute = await readFile(
      new URL("../src/app/payments/stripe/connect/refresh/route.ts", import.meta.url),
      "utf8",
    );
    const requestUrlHelper = await readFile(new URL("../src/app/payments/request-url.ts", import.meta.url), "utf8");
    const providerActions = await readFile(new URL("../src/app/provider/actions.ts", import.meta.url), "utf8");
    const providerPage = await readFile(new URL("../src/app/provider/page.tsx", import.meta.url), "utf8");

    assert.match(connectRefreshRoute, /export async function GET/);
    assert.match(connectRefreshRoute, /requireUser/);
    assert.match(connectRefreshRoute, /ensureDraftProviderProfile/);
    assert.match(connectRefreshRoute, /createProviderStripeAccountLink/);
    assert.match(connectRefreshRoute, /getStripeConnectSetupStatus/);
    assert.match(connectRefreshRoute, /baseUrl: requestUrl\.origin/);
    assert.match(connectRefreshRoute, /returnPath: "\/account\/payments\?stripe=returned"/);
    assert.match(connectRefreshRoute, /returnPath: "\/provider\?stripe=returned"/);
    assert.match(connectRefreshRoute, /NextResponse\.redirect\(onboardingUrl\)/);
    assert.doesNotMatch(connectRefreshRoute, /account\/payments\?stripe=refresh|provider\?stripe=refresh/);
    assert.match(requestUrlHelper, /process\.env\.APP_BASE_URL/);
    assert.match(requestUrlHelper, /process\.env\.NODE_ENV !== "production"/);
    assert.match(requestUrlHelper, /isLocalBaseUrl\(requestBaseUrl\)/);
    assert.match(requestUrlHelper, /if \(process\.env\.NODE_ENV === "production"\)/);
    assert.match(requestUrlHelper, /return configuredBaseUrl \|\| undefined/);
    assert.match(requestUrlHelper, /return configuredBaseUrl \|\| requestBaseUrl \|\| undefined/);
    assert.match(providerActions, /baseUrl: await getCurrentRequestBaseUrl\(\)/);
    assert.match(
      providerActions,
      /refreshPath: "\/payments\/stripe\/connect\/refresh\?destination=provider"/,
    );
    assert.match(providerActions, /getStripeConnectSetupStatus/);
    assert.match(providerPage, /Stripe Connect is not enabled/);
  });
});
