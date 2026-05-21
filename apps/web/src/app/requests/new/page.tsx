import Link from "next/link";
import { CalendarClock, Home, UserRound } from "lucide-react";
import { requireUser } from "../../lib/auth";
import { getUserAccount } from "../../account/db";
import { providerServiceOptions, providerServiceValues } from "../../provider/services.js";
import { getActiveRequestProviderTarget } from "../db";
import { createServiceRequest } from "../actions";
import {
  getTodayDateString,
  requestDurationOptions,
  requestMatchPreferenceOptions,
  requestUrgencyOptions,
} from "../validation.js";

export const dynamic = "force-dynamic";

type NewRequestPageProps = {
  searchParams?: Promise<{
    providerId?: string | string[];
    service?: string | string[];
    zip?: string | string[];
    matchPreference?: string | string[];
    status?: string | string[];
  }>;
};

function getParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function parseProviderId(value?: string) {
  if (!value || !/^\d+$/.test(value)) return null;
  const providerId = Number.parseInt(value, 10);
  return providerId > 0 ? providerId : null;
}

function getStatusMessage(status?: string) {
  if (status === "invalid") {
    return {
      className: "form-alert error full",
      copy: "Please complete the required fields with a valid future time window and ZIP code.",
      role: "alert",
    };
  }

  if (status === "error") {
    return {
      className: "form-alert error full",
      copy: "We could not submit your request. Check the environment configuration and try again.",
      role: "alert",
    };
  }

  return null;
}

export default async function NewServiceRequestPage({ searchParams }: NewRequestPageProps) {
  const user = await requireUser();
  const account = await getUserAccount(user.id);
  const params = searchParams ? await searchParams : {};
  const providerId = parseProviderId(getParam(params.providerId));
  const requestedService = getParam(params.service);
  const requestedZip = getParam(params.zip);
  const requestedMatchPreference = getParam(params.matchPreference);
  const status = getParam(params.status);
  const provider = providerId ? await getActiveRequestProviderTarget(providerId) : null;
  const providerServiceTypes = new Set(provider?.services.map((service) => service.serviceType) ?? []);
  const selectedService =
    requestedService &&
    providerServiceValues.includes(requestedService) &&
    (!provider || providerServiceTypes.has(requestedService))
      ? requestedService
      : provider?.services[0]?.serviceType ?? "";
  const selectedZip = requestedZip && /^\d{5}$/.test(requestedZip) ? requestedZip : provider?.zipCode ?? "";
  const matchPreference =
    provider && requestedMatchPreference === "specific" ? "specific" : requestMatchPreferenceOptions[0].value;
  const statusMessage = getStatusMessage(status);
  const contactName = account?.name || user.name || "";
  const contactEmail = account?.email || user.email || "";

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
        <h1>Request service</h1>
        <p>Tell us what you need, when you need it, and how providers should reach you.</p>
      </section>

      <form className="form-card provider-profile-form request-form" action={createServiceRequest}>
        {statusMessage ? (
          <p className={statusMessage.className} role={statusMessage.role}>
            {statusMessage.copy}
          </p>
        ) : null}

        <input name="providerProfileId" type="hidden" value={provider?.id ?? ""} />

        <fieldset className="radio-group full">
          <legend>Provider preference</legend>
          <label>
            <input
              name="matchPreference"
              type="radio"
              value="any"
              defaultChecked={matchPreference !== "specific"}
            />
            <span>Any matching provider</span>
          </label>
          {provider ? (
            <label>
              <input
                name="matchPreference"
                type="radio"
                value="specific"
                defaultChecked={matchPreference === "specific"}
              />
              <span>{provider.displayName || "This provider"}</span>
            </label>
          ) : null}
        </fieldset>

        {provider ? (
          <section className="request-context full" aria-label="Selected provider">
            <UserRound size={19} />
            <span>Requesting {provider.displayName || "this provider"} or another matching provider.</span>
          </section>
        ) : null}

        <label>
          Service needed
          <select name="serviceType" defaultValue={selectedService} required>
            <option value="">Select a service</option>
            {providerServiceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          ZIP code
          <input
            name="zipCode"
            type="text"
            placeholder="94107"
            defaultValue={selectedZip}
            inputMode="numeric"
            autoComplete="postal-code"
            required
          />
        </label>

        <label>
          Requested date
          <input name="requestedDate" type="date" min={getTodayDateString()} defaultValue={getTodayDateString()} required />
        </label>

        <label>
          Duration
          <select name="durationMinutes" defaultValue="60" required>
            {requestDurationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Earliest start
          <input name="windowStartTime" type="time" defaultValue="09:00" required />
        </label>

        <label>
          Latest end
          <input name="windowEndTime" type="time" defaultValue="12:00" required />
        </label>

        <fieldset className="radio-group full">
          <legend>Urgency</legend>
          {requestUrgencyOptions.map((option) => (
            <label key={option.value}>
              <input
                name="urgency"
                type="radio"
                value={option.value}
                defaultChecked={option.value === "soon"}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>

        <label>
          Contact name
          <input name="contactName" type="text" defaultValue={contactName} autoComplete="name" required />
        </label>

        <label>
          Contact email
          <input name="contactEmail" type="email" defaultValue={contactEmail} autoComplete="email" required />
        </label>

        <label className="full">
          Contact phone
          <input name="contactPhone" type="tel" placeholder="(555) 123-4567" autoComplete="tel" required />
        </label>

        <label className="full">
          Notes
          <textarea
            name="notes"
            placeholder="Share details about the task, preferences, accessibility needs, or anything the provider should know."
            rows={5}
          />
        </label>

        <section className="request-context full" aria-label="Request summary note">
          <CalendarClock size={19} />
          <span>Submitting this creates a request only. Provider matching and confirmations come next.</span>
        </section>

        <button className="button button-primary form-button full" type="submit">
          Submit request
        </button>
      </form>
    </main>
  );
}
