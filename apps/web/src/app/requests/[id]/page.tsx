import Link from "next/link";
import { CalendarCheck2, Clock, Home, MapPin, MessageCircle, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { requireUser } from "../../lib/auth";
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
        <h1>Request submitted</h1>
        <p>Your request has been saved. Provider matching and responses will be added in the next workflow.</p>
      </section>

      <section className="request-confirmation-card">
        <p className="form-alert success full" role="status">
          Request #{request.id} is submitted.
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

        <div className="request-actions">
          <Link className="button button-primary" href="/providers">
            Find more providers
          </Link>
          <Link className="button button-outline" href="/requests/new">
            Submit another request
          </Link>
        </div>
      </section>
    </main>
  );
}
