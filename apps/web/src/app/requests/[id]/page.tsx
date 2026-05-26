import Link from "next/link";
import { CalendarCheck2, Clock, Home, MapPin, MessageCircle, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { requireUser } from "../../lib/auth";
import { MessageThread } from "../../messages/message-thread";
import { getMessageThreadBundlesForMatchesForUser } from "../../messages/db";
import { getServiceRequestForRequester } from "../db";

export const dynamic = "force-dynamic";

type RequestConfirmationPageProps = {
  params?: Promise<{
    id?: string;
  }>;
};

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
  if (status === "confirmed") return "confirmed";
  if (status === "completed") return "completed";
  if (status === "canceled") return "canceled";
  return "submitted";
}

export default async function RequestConfirmationPage({ params }: RequestConfirmationPageProps) {
  const user = await requireUser();
  const resolvedParams = params ? await params : {};
  const requestId = parseRequestId(resolvedParams.id);

  if (!requestId) {
    notFound();
  }

  const request = await getServiceRequestForRequester(requestId, user.id);

  if (!request) {
    notFound();
  }
  const hasMatches = request.matches.length > 0;
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
            : hasMatches
              ? "Your request has been saved and sent to the selected provider."
              : "Your request was saved, but no eligible provider matched the selected time."}
        </p>
      </section>

      <section className="request-confirmation-card">
        <p className="form-alert success full" role="status">
          Request #{request.id} is {formatRequestStatus(request.status)}.
        </p>

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
              <h2>Confirmed booking</h2>
              <p>
                {request.booking.providerDisplayName || "Provider"} · {formatDate(request.booking.bookingDate)} ·{" "}
                {formatTime(request.booking.startTime)} - {formatTime(request.booking.endTime)}
              </p>
            </div>
          </section>
        ) : null}

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
