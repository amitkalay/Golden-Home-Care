import type Stripe from "stripe";
import { ensureProviderTables, ensureServiceRequestTables, getPool, getSql } from "../lib/database";
import { getStripe } from "../lib/stripe";
import { providerServiceLabels } from "../provider/services.js";

export type ServicePaymentStatus = "pending" | "checkout_created" | "paid" | "failed" | "canceled";

export type ServicePaymentRecord = {
  id: number;
  serviceRequestId: number;
  serviceBookingId: number | null;
  requestProviderMatchId: number | null;
  requesterUserId: string;
  providerProfileId: number;
  providerUserId: string;
  stripeConnectedAccountId: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  currency: "usd";
  serviceAmountCents: number;
  platformFeeCents: number;
  salesTaxCents: number;
  totalAmountCents: number;
  status: ServicePaymentStatus;
  paidAt: Date | null;
  failedAt: Date | null;
  canceledAt: Date | null;
};

type CheckoutSourceRecord = {
  paymentId: number;
  requestId: number;
  requesterUserId: string;
  providerProfileId: number;
  providerDisplayName: string | null;
  providerEmail: string | null;
  serviceType: string;
  contactEmail: string;
  durationMinutes: number;
  stripeConnectedAccountId: string;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  stripeOnboardingComplete: boolean;
  serviceAmountCents: number;
  platformFeeCents: number;
  salesTaxCents: number;
  totalAmountCents: number;
  currency: "usd";
};

function getAppBaseUrl() {
  const configuredUrl =
    process.env.APP_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (!configuredUrl) {
    throw new Error("APP_BASE_URL is not configured.");
  }

  return configuredUrl.replace(/\/$/, "");
}

function normalizePaymentStatus(status: unknown): ServicePaymentStatus {
  if (
    status === "checkout_created" ||
    status === "paid" ||
    status === "failed" ||
    status === "canceled"
  ) {
    return status;
  }

  return "pending";
}

function toServicePaymentRecord(row: Record<string, unknown>): ServicePaymentRecord {
  return {
    id: Number(row.id),
    serviceRequestId: Number(row.serviceRequestId),
    serviceBookingId: row.serviceBookingId === null ? null : Number(row.serviceBookingId),
    requestProviderMatchId:
      row.requestProviderMatchId === null ? null : Number(row.requestProviderMatchId),
    requesterUserId: String(row.requesterUserId),
    providerProfileId: Number(row.providerProfileId),
    providerUserId: String(row.providerUserId),
    stripeConnectedAccountId: String(row.stripeConnectedAccountId),
    stripeCheckoutSessionId: (row.stripeCheckoutSessionId as string | null) ?? null,
    stripePaymentIntentId: (row.stripePaymentIntentId as string | null) ?? null,
    currency: "usd",
    serviceAmountCents: Number(row.serviceAmountCents),
    platformFeeCents: Number(row.platformFeeCents),
    salesTaxCents: Number(row.salesTaxCents),
    totalAmountCents: Number(row.totalAmountCents),
    status: normalizePaymentStatus(row.status),
    paidAt: (row.paidAt as Date | null) ?? null,
    failedAt: (row.failedAt as Date | null) ?? null,
    canceledAt: (row.canceledAt as Date | null) ?? null,
  };
}

function getPaymentIntentId(session: Stripe.Checkout.Session) {
  if (typeof session.payment_intent === "string") return session.payment_intent;
  return session.payment_intent?.id ?? null;
}

function getSessionPaymentId(session: Stripe.Checkout.Session) {
  const paymentId = Number.parseInt(session.metadata?.paymentId ?? "", 10);
  return Number.isInteger(paymentId) && paymentId > 0 ? paymentId : null;
}

function getConnectedAccountState(account: Stripe.Account) {
  const currentlyDue = account.requirements?.currently_due ?? [];
  const pastDue = account.requirements?.past_due ?? [];

  return {
    stripeAccountId: account.id,
    stripeChargesEnabled: Boolean(account.charges_enabled),
    stripePayoutsEnabled: Boolean(account.payouts_enabled),
    stripeOnboardingComplete: Boolean(account.details_submitted && account.charges_enabled),
    stripeRequirementsCurrentlyDue: [...currentlyDue, ...pastDue],
  };
}

async function updateProviderStripeAccount(account: Stripe.Account) {
  const sql = getSql();
  const state = getConnectedAccountState(account);

  await ensureProviderTables();
  await sql`
    UPDATE provider_profiles
    SET
      stripe_account_id = ${state.stripeAccountId},
      stripe_charges_enabled = ${state.stripeChargesEnabled},
      stripe_payouts_enabled = ${state.stripePayoutsEnabled},
      stripe_onboarding_complete = ${state.stripeOnboardingComplete},
      stripe_requirements_currently_due = ${state.stripeRequirementsCurrentlyDue},
      stripe_account_updated_at = now(),
      updated_at = now()
    WHERE stripe_account_id = ${state.stripeAccountId}
  `;

  return state;
}

export async function refreshProviderStripeAccount(stripeAccountId: string) {
  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(stripeAccountId);

  return updateProviderStripeAccount(account);
}

export async function refreshProviderStripeAccountForUser(userId: string) {
  const sql = getSql();

  await ensureProviderTables();
  const rows = await sql`
    SELECT stripe_account_id as "stripeAccountId"
    FROM provider_profiles
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  const stripeAccountId = (rows as Array<Record<string, unknown>>)[0]?.stripeAccountId;

  if (typeof stripeAccountId !== "string" || !stripeAccountId) {
    return null;
  }

  return refreshProviderStripeAccount(stripeAccountId);
}

type ProviderStripeAccountLinkOptions = {
  returnPath?: string;
  refreshPath?: string;
};

function getAppUrl(path: string) {
  const appBaseUrl = getAppBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${appBaseUrl}${normalizedPath}`;
}

export async function createProviderStripeAccountLink(
  userId: string,
  options: ProviderStripeAccountLinkOptions = {},
) {
  const sql = getSql();
  const stripe = getStripe();
  const returnPath = options.returnPath ?? "/provider?stripe=returned";
  const refreshPath = options.refreshPath ?? "/provider?stripe=refresh";

  await ensureProviderTables();
  const rows = await sql`
    SELECT
      p.id,
      p.display_name as "displayName",
      p.stripe_account_id as "stripeAccountId",
      COALESCE(p.contact_email, u.email) as email
    FROM provider_profiles p
    JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ${userId}
    LIMIT 1
  `;
  const profile = (rows as Array<Record<string, unknown>>)[0];

  if (!profile) {
    throw new Error("Provider profile is required before Stripe onboarding.");
  }

  let stripeAccountId =
    typeof profile.stripeAccountId === "string" && profile.stripeAccountId
      ? profile.stripeAccountId
      : null;

  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: (profile.email as string | null) ?? undefined,
      business_type: "individual",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: (profile.displayName as string | null) ?? "Golden Home Care provider",
        product_description: "In-home service bookings through Golden Home Care.",
      },
      metadata: {
        providerProfileId: String(profile.id),
        providerUserId: userId,
      },
    });

    stripeAccountId = account.id;
    await sql`
      UPDATE provider_profiles
      SET
        stripe_account_id = ${account.id},
        stripe_charges_enabled = ${Boolean(account.charges_enabled)},
        stripe_payouts_enabled = ${Boolean(account.payouts_enabled)},
        stripe_onboarding_complete = ${Boolean(account.details_submitted && account.charges_enabled)},
        stripe_requirements_currently_due = ${[
          ...(account.requirements?.currently_due ?? []),
          ...(account.requirements?.past_due ?? []),
        ]},
        stripe_account_updated_at = now(),
        updated_at = now()
      WHERE user_id = ${userId}
    `;
  } else {
    await refreshProviderStripeAccount(stripeAccountId);
  }

  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: getAppUrl(refreshPath),
    return_url: getAppUrl(returnPath),
    type: "account_onboarding",
  });

  return accountLink.url;
}

export async function getServicePaymentForRequester(
  requestId: number,
  requesterUserId: string,
  sql: ReturnType<typeof getSql> = getSql(),
) {
  await ensureServiceRequestTables();
  const rows = await sql`
    SELECT
      sp.id,
      sp.service_request_id as "serviceRequestId",
      sp.service_booking_id as "serviceBookingId",
      sp.request_provider_match_id as "requestProviderMatchId",
      sp.requester_user_id as "requesterUserId",
      sp.provider_profile_id as "providerProfileId",
      sp.provider_user_id as "providerUserId",
      sp.stripe_connected_account_id as "stripeConnectedAccountId",
      sp.stripe_checkout_session_id as "stripeCheckoutSessionId",
      sp.stripe_payment_intent_id as "stripePaymentIntentId",
      sp.currency,
      sp.service_amount_cents as "serviceAmountCents",
      sp.platform_fee_cents as "platformFeeCents",
      sp.sales_tax_cents as "salesTaxCents",
      sp.total_amount_cents as "totalAmountCents",
      sp.status,
      sp.paid_at as "paidAt",
      sp.failed_at as "failedAt",
      sp.canceled_at as "canceledAt"
    FROM service_payments sp
    WHERE sp.service_request_id = ${requestId}
      AND sp.requester_user_id = ${requesterUserId}
    LIMIT 1
  `;
  const record = (rows as Array<Record<string, unknown>>)[0];

  return record ? toServicePaymentRecord(record) : null;
}

function toCheckoutSourceRecord(row: Record<string, unknown>): CheckoutSourceRecord {
  return {
    paymentId: Number(row.paymentId),
    requestId: Number(row.requestId),
    requesterUserId: String(row.requesterUserId),
    providerProfileId: Number(row.providerProfileId),
    providerDisplayName: (row.providerDisplayName as string | null) ?? null,
    providerEmail: (row.providerEmail as string | null) ?? null,
    serviceType: String(row.serviceType),
    contactEmail: String(row.contactEmail),
    durationMinutes: Number(row.durationMinutes),
    stripeConnectedAccountId: String(row.stripeConnectedAccountId),
    stripeChargesEnabled: Boolean(row.stripeChargesEnabled),
    stripePayoutsEnabled: Boolean(row.stripePayoutsEnabled),
    stripeOnboardingComplete: Boolean(row.stripeOnboardingComplete),
    serviceAmountCents: Number(row.serviceAmountCents),
    platformFeeCents: Number(row.platformFeeCents),
    salesTaxCents: Number(row.salesTaxCents),
    totalAmountCents: Number(row.totalAmountCents),
    currency: "usd",
  };
}

export async function createBookingCheckoutSession(requestId: number, requesterUserId: string) {
  const sql = getSql();
  const stripe = getStripe();
  const appBaseUrl = getAppBaseUrl();

  await ensureServiceRequestTables();
  const rows = await sql`
    SELECT
      sp.id as "paymentId",
      sr.id as "requestId",
      sr.requester_user_id as "requesterUserId",
      sr.service_type as "serviceType",
      sr.contact_email as "contactEmail",
      sr.duration_minutes as "durationMinutes",
      p.id as "providerProfileId",
      p.display_name as "providerDisplayName",
      COALESCE(p.contact_email, provider_user.email) as "providerEmail",
      p.stripe_account_id as "stripeConnectedAccountId",
      p.stripe_charges_enabled as "stripeChargesEnabled",
      p.stripe_payouts_enabled as "stripePayoutsEnabled",
      p.stripe_onboarding_complete as "stripeOnboardingComplete",
      sp.service_amount_cents as "serviceAmountCents",
      sp.platform_fee_cents as "platformFeeCents",
      sp.sales_tax_cents as "salesTaxCents",
      sp.total_amount_cents as "totalAmountCents",
      sp.currency
    FROM service_payments sp
    JOIN service_requests sr ON sr.id = sp.service_request_id
    JOIN provider_profiles p ON p.id = sp.provider_profile_id
    JOIN users provider_user ON provider_user.id = p.user_id
    WHERE sp.service_request_id = ${requestId}
      AND sp.requester_user_id = ${requesterUserId}
      AND sr.status = 'payment_pending'
      AND sp.status in ('pending', 'checkout_created', 'failed')
    LIMIT 1
  `;
  const record = (rows as Array<Record<string, unknown>>)[0];

  if (!record) {
    throw new Error("No payable booking was found for this request.");
  }

  const checkout = toCheckoutSourceRecord(record);
  if (
    !checkout.stripeConnectedAccountId ||
    !checkout.stripeChargesEnabled ||
    !checkout.stripePayoutsEnabled ||
    !checkout.stripeOnboardingComplete
  ) {
    throw new Error("Provider Stripe account is not ready for payments.");
  }

  const serviceLabel = providerServiceLabels.get(checkout.serviceType) ?? checkout.serviceType;
  const providerName = checkout.providerDisplayName || "your provider";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: checkout.contactEmail,
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: checkout.currency,
          unit_amount: checkout.serviceAmountCents,
          product_data: {
            name: `${serviceLabel} with ${providerName}`,
          },
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: checkout.currency,
          unit_amount: checkout.platformFeeCents,
          product_data: {
            name: "Golden Home Care Service Fee",
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      requestId: String(checkout.requestId),
      paymentId: String(checkout.paymentId),
      providerProfileId: String(checkout.providerProfileId),
    },
    payment_intent_data: {
      application_fee_amount: checkout.platformFeeCents,
      transfer_data: {
        destination: checkout.stripeConnectedAccountId,
      },
      metadata: {
        requestId: String(checkout.requestId),
        paymentId: String(checkout.paymentId),
        providerProfileId: String(checkout.providerProfileId),
      },
    },
    success_url: `${appBaseUrl}/payments/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appBaseUrl}/requests/${checkout.requestId}`,
  });

  await sql`
    UPDATE service_payments
    SET
      stripe_checkout_session_id = ${session.id},
      stripe_payment_intent_id = ${getPaymentIntentId(session)},
      status = 'checkout_created',
      failed_at = NULL,
      canceled_at = NULL,
      updated_at = now()
    WHERE id = ${checkout.paymentId}
      AND status <> 'paid'
  `;

  if (!session.url) {
    throw new Error("Stripe Checkout did not return a redirect URL.");
  }

  return session.url;
}

export async function markCheckoutSessionPaid(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") {
    return false;
  }

  const pool = getPool();
  const client = await pool.connect();
  const metadataPaymentId = getSessionPaymentId(session);
  const paymentIntentId = getPaymentIntentId(session);
  let didBegin = false;

  await ensureServiceRequestTables();

  try {
    await client.query("BEGIN");
    didBegin = true;
    const paymentResult = await client.query(
      `
        SELECT id, service_request_id
        FROM service_payments
        WHERE stripe_checkout_session_id = $1
          OR ($2::bigint IS NOT NULL AND id = $2)
        FOR UPDATE
      `,
      [session.id, metadataPaymentId],
    );
    const payment = paymentResult.rows[0];

    if (!payment) {
      await client.query("ROLLBACK");
      didBegin = false;
      return false;
    }

    await client.query(
      `
        UPDATE service_payments
        SET
          stripe_checkout_session_id = $1,
          stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
          status = 'paid',
          paid_at = COALESCE(paid_at, now()),
          failed_at = NULL,
          canceled_at = NULL,
          updated_at = now()
        WHERE id = $3
      `,
      [session.id, paymentIntentId, payment.id],
    );

    await client.query(
      `
        UPDATE service_requests
        SET status = 'confirmed', updated_at = now()
        WHERE id = $1
          AND status = 'payment_pending'
      `,
      [payment.service_request_id],
    );

    await client.query(
      `
        UPDATE service_bookings
        SET status = 'confirmed', updated_at = now()
        WHERE service_request_id = $1
          AND status = 'payment_pending'
      `,
      [payment.service_request_id],
    );

    await client.query("COMMIT");
    didBegin = false;
    return true;
  } catch (error) {
    if (didBegin) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function markCheckoutSessionFailed(session: Stripe.Checkout.Session) {
  const sql = getSql();
  const metadataPaymentId = getSessionPaymentId(session);

  await ensureServiceRequestTables();
  await sql`
    UPDATE service_payments
    SET
      stripe_checkout_session_id = ${session.id},
      stripe_payment_intent_id = COALESCE(${getPaymentIntentId(session)}, stripe_payment_intent_id),
      status = 'failed',
      failed_at = now(),
      updated_at = now()
    WHERE status <> 'paid'
      AND (
        stripe_checkout_session_id = ${session.id}
        OR (${metadataPaymentId}::bigint IS NOT NULL AND id = ${metadataPaymentId})
      )
  `;
}

export async function markCheckoutSessionCanceled(session: Stripe.Checkout.Session) {
  const sql = getSql();
  const metadataPaymentId = getSessionPaymentId(session);

  await ensureServiceRequestTables();
  await sql`
    UPDATE service_payments
    SET
      stripe_checkout_session_id = ${session.id},
      stripe_payment_intent_id = COALESCE(${getPaymentIntentId(session)}, stripe_payment_intent_id),
      status = 'canceled',
      canceled_at = now(),
      updated_at = now()
    WHERE status <> 'paid'
      AND (
        stripe_checkout_session_id = ${session.id}
        OR (${metadataPaymentId}::bigint IS NOT NULL AND id = ${metadataPaymentId})
      )
  `;
}

export async function reconcileCheckoutSessionForRequester(
  sessionId: string,
  requesterUserId: string,
) {
  const sql = getSql();
  const stripe = getStripe();

  await ensureServiceRequestTables();
  const rows = await sql`
    SELECT service_request_id as "requestId"
    FROM service_payments
    WHERE stripe_checkout_session_id = ${sessionId}
      AND requester_user_id = ${requesterUserId}
    LIMIT 1
  `;
  const requestId = Number((rows as Array<Record<string, unknown>>)[0]?.requestId ?? 0);

  if (!requestId) {
    throw new Error("Stripe Checkout session is not linked to this requester.");
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status === "paid") {
    await markCheckoutSessionPaid(session);
  }

  return requestId;
}
