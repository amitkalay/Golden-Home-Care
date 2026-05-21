import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { CalendarClock, CheckCircle2, Clock, MapPin, MessageCircle, XCircle } from "lucide-react";
import { authOptions } from "../../lib/auth";
import {
  acceptProviderRequestMatch,
  declineProviderRequestMatch,
  proposeProviderRequestTime,
} from "../actions";
import {
  ensureDraftProviderProfile,
  getProviderProfileByUserId,
  getProviderRequestInbox,
  type ProviderRequestInboxRecord,
  type ProviderRequestMatchStatus,
} from "../db";
import { getTodayDateString } from "../request-validation.js";
import { ProviderShell } from "../ui";

export const dynamic = "force-dynamic";

type ProviderMessagesPageProps = {
  searchParams?: Promise<{
    tab?: string | string[];
    status?: string | string[];
  }>;
};

type InboxTab = "pending" | "proposed" | "accepted" | "closed";

function getParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getTab(value?: string): InboxTab {
  return value === "proposed" || value === "accepted" || value === "closed" ? value : "pending";
}

function getStatusMessage(status?: string) {
  if (status === "accepted") {
    return { className: "form-alert success", copy: "Request accepted. Other pending matches were closed." };
  }

  if (status === "declined") {
    return { className: "form-alert success", copy: "Request declined." };
  }

  if (status === "proposed") {
    return { className: "form-alert success", copy: "Alternate time proposed." };
  }

  if (status === "invalid") {
    return { className: "form-alert error", copy: "That request is no longer available for this action." };
  }

  if (status === "error") {
    return { className: "form-alert error", copy: "We could not update the request. Try again." };
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

function formatDistance(distanceMiles: number | null) {
  if (distanceMiles === null) return "Distance unavailable";
  const distance = distanceMiles < 10 ? distanceMiles.toFixed(1) : Math.round(distanceMiles).toString();

  return `${distance} mi away`;
}

function getStatusLabel(status: ProviderRequestMatchStatus) {
  if (status === "proposed") return "Proposed";
  if (status === "accepted") return "Accepted";
  if (status === "declined") return "Declined";
  if (status === "expired") return "Expired";
  return "Pending";
}

function belongsToTab(request: ProviderRequestInboxRecord, tab: InboxTab) {
  if (tab === "closed") return request.matchStatus === "declined" || request.matchStatus === "expired";
  return request.matchStatus === tab;
}

function countForTab(requests: ProviderRequestInboxRecord[], tab: InboxTab) {
  return requests.filter((request) => belongsToTab(request, tab)).length;
}

function RequestCard({ request, today }: { request: ProviderRequestInboxRecord; today: string }) {
  const isPending = request.matchStatus === "pending";
  const isAccepted = request.matchStatus === "accepted";
  const isProposed = request.matchStatus === "proposed";
  const matchSource = request.matchSource === "on_demand" ? "On-demand" : "Weekly availability";

  return (
    <article className="provider-inbox-card">
      <header className="provider-inbox-card-header">
        <div>
          <span className={`provider-status-badge status-${request.matchStatus}`}>
            {getStatusLabel(request.matchStatus)}
          </span>
          <h2>{request.serviceLabel}</h2>
          <p>
            Request #{request.requestId} from {request.contactName}
          </p>
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
          <dd>
            ZIP {request.zipCode} | {formatDistance(request.distanceMiles)}
          </dd>
        </div>
        <div>
          <dt>
            <CalendarClock size={16} /> Match
          </dt>
          <dd>{matchSource}</dd>
        </div>
        <div>
          <dt>
            <MessageCircle size={16} /> Urgency
          </dt>
          <dd>{request.urgency.charAt(0).toUpperCase() + request.urgency.slice(1)}</dd>
        </div>
      </dl>

      {request.notes ? (
        <section className="provider-inbox-note">
          <h3>Request notes</h3>
          <p>{request.notes}</p>
        </section>
      ) : null}

      {isAccepted ? (
        <section className="provider-inbox-contact">
          <h3>Requester contact</h3>
          <p>{request.contactEmail || "Email unavailable"}</p>
          <p>{request.contactPhone || "Phone unavailable"}</p>
        </section>
      ) : null}

      {isProposed && request.proposedDate && request.proposedStartTime && request.proposedEndTime ? (
        <section className="provider-inbox-note">
          <h3>Proposed time</h3>
          <p>
            {formatDate(request.proposedDate)} from {formatTime(request.proposedStartTime)} to{" "}
            {formatTime(request.proposedEndTime)}
          </p>
          {request.providerResponseNote ? <p>{request.providerResponseNote}</p> : null}
        </section>
      ) : null}

      {isPending ? (
        <div className="provider-inbox-actions">
          <form action={acceptProviderRequestMatch}>
            <input name="matchId" type="hidden" value={request.matchId} />
            <button className="button button-primary" type="submit">
              <CheckCircle2 size={18} />
              Accept
            </button>
          </form>
          <form action={declineProviderRequestMatch}>
            <input name="matchId" type="hidden" value={request.matchId} />
            <button className="button button-outline" type="submit">
              <XCircle size={18} />
              Decline
            </button>
          </form>
          <form className="provider-proposal-form" action={proposeProviderRequestTime}>
            <input name="matchId" type="hidden" value={request.matchId} />
            <label>
              Proposed date
              <input name="proposedDate" type="date" min={today} required />
            </label>
            <label>
              Start
              <input name="proposedStartTime" type="time" required />
            </label>
            <label>
              End
              <input name="proposedEndTime" type="time" required />
            </label>
            <label className="full">
              Note
              <textarea
                name="providerResponseNote"
                placeholder="Optional note about the alternate time."
                rows={3}
              />
            </label>
            <button className="button button-secondary full" type="submit">
              Propose another time
            </button>
          </form>
        </div>
      ) : null}
    </article>
  );
}

export default async function ProviderMessagesPage({ searchParams }: ProviderMessagesPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  await ensureDraftProviderProfile(session.user.id, session.user.name);
  const profile = await getProviderProfileByUserId(session.user.id);
  const requests = await getProviderRequestInbox(session.user.id);
  const params = searchParams ? await searchParams : {};
  const activeTab = getTab(getParam(params.tab));
  const statusMessage = getStatusMessage(getParam(params.status));
  const visibleRequests = requests.filter((request) => belongsToTab(request, activeTab));
  const today = getTodayDateString();
  const tabs: Array<{ value: InboxTab; label: string }> = [
    { value: "pending", label: "Pending" },
    { value: "proposed", label: "Proposed" },
    { value: "accepted", label: "Accepted" },
    { value: "closed", label: "Closed" },
  ];

  return (
    <ProviderShell
      title="Incoming requests"
      copy="Review matched service requests and respond to families."
    >
      {statusMessage ? (
        <p className={statusMessage.className} role={statusMessage.className.includes("error") ? "alert" : "status"}>
          {statusMessage.copy}
        </p>
      ) : null}

      {profile?.status !== "active" ? (
        <p className="form-alert error" role="alert">
          Activate your provider profile before responding to incoming requests.
        </p>
      ) : null}

      <nav className="provider-inbox-tabs" aria-label="Request inbox tabs">
        {tabs.map((tab) => (
          <a
            aria-current={activeTab === tab.value ? "page" : undefined}
            className={activeTab === tab.value ? "active" : undefined}
            href={`/provider/messages?tab=${tab.value}`}
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
            <RequestCard key={request.matchId} request={request} today={today} />
          ))}
        </section>
      ) : (
        <section className="provider-empty-state">
          <h2>No {activeTab} requests</h2>
          <p>Matched requests will appear here when families submit service requests in your coverage area.</p>
        </section>
      )}
    </ProviderShell>
  );
}
