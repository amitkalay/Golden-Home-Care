import Link from "next/link";
import { CalendarCheck2, Clock, CreditCard, Home, MapPin, MessageCircle, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { requireUser } from "../../lib/auth";
import { MessageThread } from "../../messages/message-thread";
import { getMessageThreadBundlesForMatchesForUser } from "../../messages/db";
import { getServiceRequestForRequester, type ServiceRequestRecord } from "../db";
import { payForServiceRequest } from "../actions";

export const dynamic = "force-dynamic";

type RequestConfirmationPageProps = {
  params?: Promise<{
    id?: string;
  }>;
  searchParams?: Promise<{
    payment?: string | string[];
  }>;
};

function getParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function parseRequestId(value?: string) {
  if (!value || !/^\d+$/.test(value)) return null;
  const requestId = Number.parseInt(value, 10);
  return requestId > 0 ? requestId : null;
}

function formatTime(value: string) {
  const [hourInput, minute] = value.split(":");
  const hour = Number.parseInt(hourInput, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatRate(rateCents: number | null) {
  if (!rateCents) return "Rate pending";
  return `$${Math.round(rateCents / 100)}/hr`;
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDuration(value: number) {
  if (value % 60 === 0) {
    const hours = value / 60;
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }

  return `${value / 60} hours`;
}

function formatDistance(distanceMiles: number | null) {
  if (distanceMiles === null) return "Distance unavailable";
  const distance = distanceMiles < 10 ? distanceMiles.toFixed(1) : Math.round(distanceMiles).toString();

  return `${distance} mi`;
}

function formatMatchStatus(status: string) {
  if (status === "proposed") return "Proposed another time";
  if (status === "accepted") return "Accepted";
  if (status === "declined") return "Declined";
  if (status === "expired") return "Closed";
  return "Pending response";
}

function formatRequestStatus(status: string) {
  if (status === "payment_pending") return "payment due";
  if (status === "confirmed") return "confirmed";
  if (status === "completed") return "completed";
  if (status === "canceled") return "canceled";
  return "submitted";
}

function PaymentReceipt({
  acceptedMatch,
  request,
}: {
  acceptedMatch: ServiceRequestRecord["matches"][number] | undefined;
  request: ServiceRequestRecord;
}) {
  if (!request.payment) return null;

  const payment = request.payment;
  const isPaid = payment.status === "paid";
  const canPay =
    request.status === "payment_pending" &&
    request.booking?.status === "payment_pending" &&
    payment.status !== "paid" &&
    payment.status !== "canceled";
  const providerName =
    request.booking?.providerDisplayName ||
    acceptedMatch?.providerDisplayName ||
    request.providerDisplayName ||
    "Provider";
  const paidDate = payment.paidAt
    ? new Intl.DateTimeFormat("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      }).format(payment.paidAt)
    : null;

  return (
    <section className="request-receipt" aria-label="Services and charges">
      <header className="request-receipt-header">
        <div>
          <h2>Services & Charges</h2>
          <p>
            {isPaid && paidDate
              ? `Paid on ${paidDate} - ${formatMoney(payment.totalAmountCents)}`
              : `Payment due - ${formatMoney(payment.totalAmountCents)}`}
          </p>
        </div>
        <CreditCard size={20} />
      </header>

      <div className="request-receipt-provider">
        <strong>{providerName}</strong>
        <span>{request.serviceLabel}</span>
      </div>

      <dl className="request-receipt-lines">
        <div>
          <dt>
            {acceptedMatch?.hourlyRateCents
              ? `${formatMoney(acceptedMatch.hourlyRateCents)} x ${formatDuration(request.durationMinutes)}`
              : `${request.durationMinutes} minute service`}
          </dt>
          <dd>{formatMoney(payment.serviceAmountCents)}</dd>
        </div>
        <div>
          <dt>Golden Home Care Service Fee</dt>
          <dd>{formatMoney(payment.platformFeeCents)}</dd>
        </div>
        <div>
          <dt>Sales Tax</dt>
          <dd>{formatMoney(payment.salesTaxCents)}</dd>
        </div>
        <div className="request-receipt-total">
          <dt>Subtotal</dt>
          <dd>{formatMoney(payment.totalAmountCents)}</dd>
        </div>
      </dl>

      {canPay ? (
        <form action={payForServiceRequest}>
          <input name="requestId" type="hidden" value={request.id} />
          <button className="button button-primary" type="submit">
            <CreditCard size={18} />
            Pay with Stripe
          </button>
        </form>
      ) : null}
    </section>
  );
}

export default async function RequestConfirmationPage({ params, searchParams }: RequestConfirmationPageProps) {
  const user = await requireUser();
  const resolvedParams = params ? await params : {};
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestId = parseRequestId(resolvedParams.id);

  if (!requestId) {
    notFound();
  }

  const request = await getServiceRequestForRequester(requestId, user.id);

  if (!request) {
    notFound();
  }
  const hasMatches = request.matches.length > 0;
  const paymentStatus = getParam(resolvedSearchParams.payment);
  const acceptedMatch = request.matches.find((match) => match.status === "accepted");
  const threadBundles = await getMessageThreadBundlesForMatchesForUser(
    request.matches.map((match) => match.id),
    user.id,
  );
  const threadBundlesByMatchId = new Map(
    threadBundles.map((bundle) => [bundle.thread.requestProviderMatchId, bundle]),
  );

  return (
    <main className="provider-shell request-shell">
      <header className="provider-topbar">
        <Link className="brand provider-brand" href="/">
          <Home size={30} strokeWidth={1.6} />
          Golden Home Care
        </Link>
        <nav className="provider-nav" aria-label="Request navigation">
          <Link href="/providers">Find providers</Link>
          <Link href="/account">Account</Link>
        </nav>
      </header>

      <section className="provider-page-heading">
        <h1>Request {formatRequestStatus(request.status)}</h1>
        <p>
          {request.booking?.status === "confirmed"
            ? "A provider accepted this request and your booking is confirmed."
            : request.booking?.status === "payment_pending"
              ? "A provider accepted this request. Complete payment to confirm the booking."
            : hasMatches
              ? "Your request has been saved and sent to the selected provider."
              : "Your request was saved, but no eligible provider matched the selected time."}
        </p>
      </section>

      <section className="request-confirmation-card">
        <p className="form-alert success full" role="status">
          Request #{request.id} is {formatRequestStatus(request.status)}.
        </p>

        {paymentStatus === "error" ? (
          <p className="form-alert error full" role="alert">
            We could not start Stripe Checkout. Try again from the payment receipt.
          </p>
        ) : null}

        <div className="request-confirmation-grid">
          <article>
            <CalendarCheck2 size={22} />
            <span>Service</span>
            <strong>{request.serviceLabel}</strong>
            <p>{request.matchPreference === "specific" ? request.providerDisplayName || "Selected provider" : "Any matching provider"}</p>
          </article>
          <article>
            <Clock size={22} />
            <span>When</span>
            <strong>{formatDate(request.requestedDate)}</strong>
            <p>
              {formatTime(request.windowStartTime)} - {formatTime(request.windowEndTime)} · {request.durationMinutes} min
            </p>
          </article>
          <article>
            <MapPin size={22} />
            <span>Location</span>
            <strong>ZIP {request.zipCode}</strong>
            <p>{request.urgency.charAt(0).toUpperCase() + request.urgency.slice(1)} urgency</p>
          </article>
          <article>
            <UserRound size={22} />
            <span>Contact</span>
            <strong>{request.contactName}</strong>
            <p>{request.contactEmail} · {request.contactPhone}</p>
          </article>
        </div>

        {request.notes ? (
          <section className="request-notes">
            <MessageCircle size={19} />
            <div>
              <h2>Notes</h2>
              <p>{request.notes}</p>
            </div>
          </section>
        ) : null}

        {request.booking ? (
          <section className="request-notes">
            <CalendarCheck2 size={19} />
            <div>
              <h2>{request.booking.status === "payment_pending" ? "Booking pending payment" : "Confirmed booking"}</h2>
              <p>
                {request.booking.providerDisplayName || "Provider"} · {formatDate(request.booking.bookingDate)} ·{" "}
                {formatTime(request.booking.startTime)} - {formatTime(request.booking.endTime)}
              </p>
            </div>
          </section>
        ) : null}

        <PaymentReceipt acceptedMatch={acceptedMatch} request={request} />

        <section className="request-notes">
          <UserRound size={19} />
          <div>
            <h2>
              {request.matches.length === 1
                ? "1 provider match"
                : `${request.matches.length} provider matches`}
            </h2>
            {request.matches.length ? (
              <ul className="request-match-list">
                {request.matches.map((match) => {
                  const threadBundle = threadBundlesByMatchId.get(match.id);

                  return (
                    <li key={match.id}>
                      <strong>{match.providerDisplayName || `Provider #${match.providerProfileId}`}</strong>
                      <span>
                        {formatRate(match.hourlyRateCents)} · {formatDistance(match.distanceMiles)} ·{" "}
                        {match.matchSource === "on_demand" ? "On-demand" : "Weekly availability"} ·{" "}
                        {formatMatchStatus(match.status)}
                      </span>
                      {match.status === "proposed" &&
                      match.proposedDate &&
                      match.proposedStartTime &&
                      match.proposedEndTime ? (
                        <span>
                          Proposed: {formatDate(match.proposedDate)} from{" "}
                          {formatTime(match.proposedStartTime)} to {formatTime(match.proposedEndTime)}
                        </span>
                      ) : null}
                      {match.providerResponseNote ? <span>{match.providerResponseNote}</span> : null}
                      {match.messageUnreadCount ? (
                        <span className="provider-status-badge status-proposed">
                          {match.messageUnreadCount} unread messages
                        </span>
                      ) : null}
                      {threadBundle ? (
                        <div className="request-match-message" id={`message-thread-${match.id}`}>
                          <MessageThread
                            currentUserId={user.id}
                            initialMessages={threadBundle.messages}
                            thread={threadBundle.thread}
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>No eligible provider matched this request time.</p>
            )}
          </div>
        </section>

        <div className="request-actions">
          <Link className="button button-outline" href="/account/requests">
            View my requests
          </Link>
          <Link className="button button-primary" href="/providers">
            Find more providers
          </Link>
          <Link className="button button-outline" href="/providers">
            Submit another request
          </Link>
        </div>
      </section>
    </main>
  );
}
