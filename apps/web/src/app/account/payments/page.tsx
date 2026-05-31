import Link from "next/link";
import { CreditCard, Home, Landmark, ReceiptText } from "lucide-react";
import { requireUser } from "../../lib/auth";
import { getUnreadNotificationCount } from "../../notifications/db";
import { refreshProviderStripeAccountForUser } from "../../payments/db";
import { getProviderProfileByUserId, type ProviderProfileRecord } from "../../provider/db";
import { payForServiceRequest } from "../../requests/actions";
import { getServiceRequestsForRequester, type ServiceRequestRecord } from "../../requests/db";
import { startAccountStripeProviderOnboarding } from "./actions";

export const dynamic = "force-dynamic";

type AccountPaymentsPageProps = {
  searchParams?: Promise<{
    stripe?: string | string[];
  }>;
};

function getParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatTime(value: string) {
  const [hourInput, minute] = value.split(":");
  const hour = Number.parseInt(hourInput, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatPaidDate(value: Date | null) {
  if (!value) return "Paid";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function getStripeStatusMessage(status?: string) {
  if (status === "returned") {
    return {
      className: "form-alert success",
      copy: "Stripe payout setup has been refreshed.",
      role: "status" as const,
    };
  }

  if (status === "refresh") {
    return {
      className: "form-alert error",
      copy: "That Stripe onboarding link expired. Start payout setup again to create a fresh link.",
      role: "alert" as const,
    };
  }

  if (status === "config") {
    return {
      className: "form-alert error",
      copy: "Stripe test payouts are not fully configured on the server yet.",
      role: "alert" as const,
    };
  }

  if (status === "connect-disabled") {
    return {
      className: "form-alert error",
      copy: "Stripe Connect is not enabled for this Stripe test account. Enable Connect in Stripe, then start payout setup again.",
      role: "alert" as const,
    };
  }

  if (status === "setup-error" || status === "error") {
    return {
      className: "form-alert error",
      copy: "We could not start Stripe payout setup. Try again in a moment.",
      role: "alert" as const,
    };
  }

  return null;
}

function isPaymentDue(request: ServiceRequestRecord) {
  return Boolean(
    request.payment &&
      (request.status === "payment_pending" || request.booking?.status === "payment_pending") &&
      request.payment.status !== "paid" &&
      request.payment.status !== "canceled",
  );
}

function getPaymentStatusLabel(request: ServiceRequestRecord) {
  if (request.payment?.status === "failed") return "Retry payment";
  if (request.payment?.status === "checkout_created") return "Checkout started";
  return "Payment due";
}

function PaymentDueCard({ request }: { request: ServiceRequestRecord }) {
  const payment = request.payment;
  if (!payment) return null;

  return (
    <article className="account-payment-card">
      <header className="account-payment-card-header">
        <div>
          <span className="provider-status-badge status-accepted">{getPaymentStatusLabel(request)}</span>
          <h3>{request.serviceLabel}</h3>
          <p>
            {formatDate(request.requestedDate)} · {formatTime(request.windowStartTime)} -{" "}
            {formatTime(request.windowEndTime)}
          </p>
        </div>
        <strong>{formatMoney(payment.totalAmountCents)}</strong>
      </header>
      <dl className="account-payment-breakdown">
        <div>
          <dt>Provider</dt>
          <dd>{request.booking?.providerDisplayName || request.providerDisplayName || "Provider"}</dd>
        </div>
        <div>
          <dt>Service</dt>
          <dd>{formatMoney(payment.serviceAmountCents)}</dd>
        </div>
        <div>
          <dt>Golden Home Care fee</dt>
          <dd>{formatMoney(payment.platformFeeCents)}</dd>
        </div>
      </dl>
      <div className="request-actions">
        <form action={payForServiceRequest}>
          <input name="requestId" type="hidden" value={request.id} />
          <button className="button button-primary" type="submit">
            <CreditCard size={17} />
            Pay with Stripe
          </button>
        </form>
        <Link className="button button-outline" href={`/requests/${request.id}`}>
          View receipt
        </Link>
      </div>
    </article>
  );
}

function PaidPaymentCard({ request }: { request: ServiceRequestRecord }) {
  const payment = request.payment;
  if (!payment) return null;

  return (
    <article className="account-payment-card compact">
      <div>
        <span className="provider-status-badge status-confirmed">Paid</span>
        <h3>{request.serviceLabel}</h3>
        <p>
          {formatPaidDate(payment.paidAt)} · {request.booking?.providerDisplayName || request.providerDisplayName || "Provider"}
        </p>
      </div>
      <div className="account-payment-history-actions">
        <strong>{formatMoney(payment.totalAmountCents)}</strong>
        <Link className="button button-outline" href={`/requests/${request.id}`}>
          Receipt
        </Link>
      </div>
    </article>
  );
}

function getPayoutState(profile: ProviderProfileRecord | null) {
  if (!profile) {
    return {
      badge: "Not a provider",
      title: "Provider profile required",
      copy: "Create a provider profile before adding payout details.",
      ready: false,
    };
  }

  const ready = Boolean(
    profile.stripeAccountId &&
      profile.stripeChargesEnabled &&
      profile.stripePayoutsEnabled &&
      profile.stripeOnboardingComplete,
  );

  if (ready) {
    return {
      badge: "Ready",
      title: "Payouts enabled",
      copy: "Stripe test payouts are ready for accepted bookings.",
      ready,
    };
  }

  if (profile.stripeAccountId) {
    return {
      badge: "Action needed",
      title: "Finish Stripe setup",
      copy: "Complete the remaining Stripe requirements before accepting paid bookings.",
      ready,
    };
  }

  return {
    badge: "Not set up",
    title: "Set up provider payouts",
    copy: "Add payout details through Stripe before accepting paid bookings.",
    ready,
  };
}

function ProviderPayoutPanel({ profile }: { profile: ProviderProfileRecord | null }) {
  const payoutState = getPayoutState(profile);
  const requirements = profile?.stripeRequirementsCurrentlyDue ?? [];

  return (
    <section className="account-payments-panel" aria-labelledby="provider-payouts-heading">
      <header className="account-payments-section-heading">
        <span className="account-payment-icon">
          <Landmark size={20} />
        </span>
        <div>
          <h2 id="provider-payouts-heading">Provider payouts</h2>
          <p>Stripe Connect status for receiving provider payments.</p>
        </div>
      </header>

      <div className="account-payout-status">
        <span className={`provider-status-badge${payoutState.ready ? " status-confirmed" : " status-proposed"}`}>
          {payoutState.badge}
        </span>
        <h3>{payoutState.title}</h3>
        <p>{payoutState.copy}</p>
      </div>

      {profile ? (
        <dl className="account-payment-breakdown">
          <div>
            <dt>Charges</dt>
            <dd>{profile.stripeChargesEnabled ? "Enabled" : "Not enabled"}</dd>
          </div>
          <div>
            <dt>Payouts</dt>
            <dd>{profile.stripePayoutsEnabled ? "Enabled" : "Not enabled"}</dd>
          </div>
          <div>
            <dt>Onboarding</dt>
            <dd>{profile.stripeOnboardingComplete ? "Complete" : "Incomplete"}</dd>
          </div>
        </dl>
      ) : null}

      {requirements.length ? (
        <div className="account-payment-requirements">
          <h3>Outstanding requirements</h3>
          <ul>
            {requirements.map((requirement) => (
              <li key={requirement}>{requirement.replaceAll("_", " ")}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {profile ? (
        <form action={startAccountStripeProviderOnboarding}>
          <button className="button button-primary" type="submit">
            <CreditCard size={17} />
            {profile.stripeAccountId ? "Finish payout setup" : "Set up payouts"}
          </button>
        </form>
      ) : (
        <Link className="button button-primary" href="/provider/onboarding">
          Become a provider
        </Link>
      )}
    </section>
  );
}

export default async function AccountPaymentsPage({ searchParams }: AccountPaymentsPageProps) {
  const user = await requireUser();
  const params = searchParams ? await searchParams : {};
  const stripeStatus = getParam(params.stripe);

  if (stripeStatus === "returned" || stripeStatus === "refresh") {
    try {
      await refreshProviderStripeAccountForUser(user.id);
    } catch (error) {
      console.error("Failed to refresh account Stripe provider status", error);
    }
  }

  const [requests, providerProfile, unreadNotificationCount] = await Promise.all([
    getServiceRequestsForRequester(user.id),
    getProviderProfileByUserId(user.id),
    getUnreadNotificationCount(user.id),
  ]);
  const dueRequests = requests.filter(isPaymentDue);
  const paidRequests = requests.filter((request) => request.payment?.status === "paid");
  const stripeStatusMessage = getStripeStatusMessage(stripeStatus);

  return (
    <main className="provider-shell account-shell">
      <header className="provider-topbar">
        <Link className="brand provider-brand" href="/">
          <Home size={30} strokeWidth={1.6} />
          Golden Home Care
        </Link>
        <nav className="provider-nav" aria-label="Account payments navigation">
          <Link href="/account">Account</Link>
          <Link href="/account/requests">My requests</Link>
          <Link aria-current="page" href="/account/payments">
            Payments
          </Link>
          <Link className="notification-nav-link" href="/account/notifications">
            Notifications
            {unreadNotificationCount ? <span>{unreadNotificationCount}</span> : null}
          </Link>
          <Link href="/providers">Find providers</Link>
          <Link href="/provider">Provider dashboard</Link>
        </nav>
      </header>

      <section className="provider-page-heading">
        <h1>Payments</h1>
        <p>Booking charges, receipts, and provider payout setup.</p>
      </section>

      {stripeStatusMessage ? (
        <p className={stripeStatusMessage.className} role={stripeStatusMessage.role}>
          {stripeStatusMessage.copy}
        </p>
      ) : null}

      <div className="account-payments-layout">
        <section className="account-payments-main" aria-labelledby="requester-payments-heading">
          <header className="account-payments-section-heading">
            <span className="account-payment-icon">
              <ReceiptText size={20} />
            </span>
            <div>
              <h2 id="requester-payments-heading">Requester payments</h2>
              <p>Cards are entered in Stripe Checkout when payment is due.</p>
            </div>
          </header>

          <section className="account-payments-group" aria-labelledby="payment-due-heading">
            <h3 id="payment-due-heading">Payment due</h3>
            {dueRequests.length ? (
              <div className="account-payment-list">
                {dueRequests.map((request) => (
                  <PaymentDueCard key={request.id} request={request} />
                ))}
              </div>
            ) : (
              <div className="provider-empty-state compact">
                <h4>No payments due</h4>
                <p>Accepted bookings that need payment will appear here.</p>
              </div>
            )}
          </section>

          <section className="account-payments-group" aria-labelledby="paid-payments-heading">
            <h3 id="paid-payments-heading">Paid receipts</h3>
            {paidRequests.length ? (
              <div className="account-payment-list">
                {paidRequests.map((request) => (
                  <PaidPaymentCard key={request.id} request={request} />
                ))}
              </div>
            ) : (
              <div className="provider-empty-state compact">
                <h4>No paid receipts</h4>
                <p>Completed Stripe payments will appear here.</p>
              </div>
            )}
          </section>
        </section>

        <ProviderPayoutPanel profile={providerProfile} />
      </div>
    </main>
  );
}
