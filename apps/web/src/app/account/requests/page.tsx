import Link from "next/link";
import { CalendarCheck2, Clock, CreditCard, Home, MapPin, MessageCircle, XCircle } from "lucide-react";
import { requireUser } from "../../lib/auth";
import { getUnreadNotificationCount } from "../../notifications/db";
import { ServiceLabel } from "../../provider/service-label";
import { cancelServiceRequest, payForServiceRequest } from "../../requests/actions";
import type { ServiceRequestRecord } from "../../requests/db";
import { getServiceRequestsForRequester } from "../../requests/db";

export const dynamic = "force-dynamic";

type AccountRequestsPageProps = {
  searchParams?: Promise<{
    tab?: string | string[];
    status?: string | string[];
  }>;
};

type RequestTab = "pending" | "accepted" | "declined" | "confirmed" | "completed" | "canceled";

function getParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getTab(value?: string): RequestTab {
  if (
    value === "accepted" ||
    value === "declined" ||
    value === "confirmed" ||
    value === "completed" ||
    value === "canceled"
  ) {
    return value;
  }

  return "pending";
}

function getStatusMessage(status?: string) {
  if (status === "canceled") {
    return { className: "form-alert success", copy: "Request canceled.", role: "status" };
  }

  if (status === "invalid") {
    return { className: "form-alert error", copy: "That request cannot be canceled.", role: "alert" };
  }

  if (status === "error") {
    return { className: "form-alert error", copy: "We could not update the request. Try again.", role: "alert" };
  }

  return null;
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

function getRequestRollupStatus(request: ServiceRequestRecord): RequestTab {
  if (request.status === "canceled") return "canceled";
  if (request.status === "completed" || request.booking?.status === "completed") return "completed";
  if (request.status === "confirmed" || request.booking?.status === "confirmed") return "confirmed";
  if (request.status === "payment_pending" || request.booking?.status === "payment_pending") return "accepted";
  if (request.matches.some((match) => match.status === "accepted")) return "accepted";
  if (
    request.matches.length > 0 &&
    request.matches.every((match) => match.status === "declined" || match.status === "expired")
  ) {
    return "declined";
  }

  return "pending";
}

function getStatusLabel(status: RequestTab) {
  if (status === "accepted") return "Accepted";
  if (status === "declined") return "Declined";
  if (status === "confirmed") return "Confirmed";
  if (status === "completed") return "Completed";
  if (status === "canceled") return "Canceled";
  return "Pending";
}

function getMatchStatusLabel(status: string) {
  if (status === "accepted") return "Accepted";
  if (status === "proposed") return "Proposed another time";
  if (status === "declined") return "Declined";
  if (status === "expired") return "Closed";
  return "Pending";
}

function countForTab(requests: ServiceRequestRecord[], tab: RequestTab) {
  return requests.filter((request) => getRequestRollupStatus(request) === tab).length;
}

function RequestCard({ request }: { request: ServiceRequestRecord }) {
  const status = getRequestRollupStatus(request);
  const isPaymentDue =
    request.status === "payment_pending" ||
    request.booking?.status === "payment_pending";
  const canCancel = status !== "completed" && status !== "canceled";
  const messageUnreadCount = request.matches.reduce(
    (count, match) => count + match.messageUnreadCount,
    0,
  );
  const messageMatch = request.matches.find((match) => match.messageUnreadCount > 0) ?? request.matches[0];

  return (
    <article className="provider-inbox-card">
      <header className="provider-inbox-card-header">
        <div>
          <span className={`provider-status-badge status-${status}`}>
            {isPaymentDue ? "Payment due" : getStatusLabel(status)}
          </span>
          <h2>
            <ServiceLabel label={request.serviceLabel} serviceType={request.serviceType} />
          </h2>
          <p>Request #{request.id}</p>
        </div>
        <div className="provider-inbox-card-time">
          <strong>{formatDate(request.requestedDate)}</strong>
          <span>
            {formatTime(request.windowStartTime)} - {formatTime(request.windowEndTime)}
          </span>
        </div>
      </header>

      <dl className="provider-inbox-facts">
        <div>
          <dt>
            <Clock size={16} /> Duration
          </dt>
          <dd>{request.durationMinutes} minutes</dd>
        </div>
        <div>
          <dt>
            <MapPin size={16} /> Location
          </dt>
          <dd>ZIP {request.zipCode}</dd>
        </div>
        <div>
          <dt>
            <CalendarCheck2 size={16} /> Booking
          </dt>
          <dd>
            {request.booking
              ? `${request.booking.providerDisplayName || "Provider"} | ${formatTime(request.booking.startTime)}-${formatTime(request.booking.endTime)}${request.booking.status === "payment_pending" ? " | payment due" : ""}`
              : "Not confirmed yet"}
          </dd>
        </div>
        <div>
          <dt>
            <MessageCircle size={16} /> Responses
          </dt>
          <dd>
            {request.matches.length} provider matches
            {messageUnreadCount ? ` | ${messageUnreadCount} unread messages` : ""}
          </dd>
        </div>
      </dl>

      {request.matches.length ? (
        <section className="provider-inbox-note">
          <h3>Provider responses</h3>
          <ul className="request-match-list">
            {request.matches.map((match) => (
              <li key={match.id}>
                <strong>{match.providerDisplayName || `Provider #${match.providerProfileId}`}</strong>
                <span>{getMatchStatusLabel(match.status)}</span>
                {match.status === "proposed" &&
                match.proposedDate &&
                match.proposedStartTime &&
                match.proposedEndTime ? (
                  <span>
                    Proposed: {formatDate(match.proposedDate)} from {formatTime(match.proposedStartTime)} to{" "}
                    {formatTime(match.proposedEndTime)}
                  </span>
                ) : null}
                {match.providerResponseNote ? <span>{match.providerResponseNote}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {request.notes ? (
        <section className="provider-inbox-note">
          <h3>Your notes</h3>
          <p>{request.notes}</p>
        </section>
      ) : null}

      <div className="request-actions">
        <Link className="button button-outline" href={`/requests/${request.id}`}>
          View details
        </Link>
        {messageMatch ? (
          <Link className="button button-outline" href={`/requests/${request.id}#message-thread-${messageMatch.id}`}>
            Messages
            {messageUnreadCount ? ` (${messageUnreadCount})` : ""}
          </Link>
        ) : null}
        {isPaymentDue ? (
          <form action={payForServiceRequest}>
            <input name="requestId" type="hidden" value={request.id} />
            <button className="button button-primary" type="submit">
              <CreditCard size={17} />
              Pay
            </button>
          </form>
        ) : null}
        {canCancel ? (
          <form action={cancelServiceRequest}>
            <input name="requestId" type="hidden" value={request.id} />
            <button className="button button-outline danger-button" type="submit">
              <XCircle size={17} />
              Cancel request
            </button>
          </form>
        ) : null}
      </div>
    </article>
  );
}

export default async function AccountRequestsPage({ searchParams }: AccountRequestsPageProps) {
  const user = await requireUser();
  const [requests, unreadNotificationCount] = await Promise.all([
    getServiceRequestsForRequester(user.id),
    getUnreadNotificationCount(user.id),
  ]);
  const params = searchParams ? await searchParams : {};
  const activeTab = getTab(getParam(params.tab));
  const statusMessage = getStatusMessage(getParam(params.status));
  const visibleRequests = requests.filter((request) => getRequestRollupStatus(request) === activeTab);
  const tabs: Array<{ value: RequestTab; label: string }> = [
    { value: "pending", label: "Pending" },
    { value: "accepted", label: "Accepted" },
    { value: "declined", label: "Declined" },
    { value: "confirmed", label: "Confirmed" },
    { value: "completed", label: "Completed" },
    { value: "canceled", label: "Canceled" },
  ];

  return (
    <main className="provider-shell account-shell">
      <header className="provider-topbar">
        <Link className="brand provider-brand" href="/">
          <Home size={30} strokeWidth={1.6} />
          Golden Home Care
        </Link>
        <nav className="provider-nav" aria-label="Account request navigation">
          <Link href="/account">Account</Link>
          <Link href="/account/payments">Payments</Link>
          <Link className="notification-nav-link" href="/account/notifications">
            Notifications
            {unreadNotificationCount ? <span>{unreadNotificationCount}</span> : null}
          </Link>
          <Link href="/providers">Find providers</Link>
          <Link href="/provider">Provider dashboard</Link>
        </nav>
      </header>

      <section className="provider-page-heading">
        <h1>My requests</h1>
        <p>Current and past home care requests.</p>
      </section>

      {statusMessage ? (
        <p className={statusMessage.className} role={statusMessage.role}>
          {statusMessage.copy}
        </p>
      ) : null}

      <nav className="provider-inbox-tabs" aria-label="Request status tabs">
        {tabs.map((tab) => (
          <a
            aria-current={activeTab === tab.value ? "page" : undefined}
            className={activeTab === tab.value ? "active" : undefined}
            href={`/account/requests?tab=${tab.value}`}
            key={tab.value}
          >
            {tab.label}
            <span>{countForTab(requests, tab.value)}</span>
          </a>
        ))}
      </nav>

      {visibleRequests.length ? (
        <section className="provider-inbox-list" aria-label={`${activeTab} requests`}>
          {visibleRequests.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </section>
      ) : (
        <section className="provider-empty-state">
          <h2>No {activeTab} requests</h2>
          <p>No requests in this status.</p>
        </section>
      )}
    </main>
  );
}
