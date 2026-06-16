import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, CalendarCheck2, CreditCard, MessageCircle, Search, UserRound } from "lucide-react";
import { ServiceLabel } from "./service-label";
import { providerServiceOptions } from "./services.js";
import type { ProviderProfileRecord } from "./db";
import { SignOutButton } from "../sign-out-button";
import {
  availabilityDayOptions,
  availabilityTimezoneOptions,
  defaultAvailabilityTimezone,
  minimumNoticeOptions,
} from "./profile-validation.js";
import {
  saveProviderAvailability,
  saveProviderOnboarding,
  saveProviderProfile,
  startStripeProviderOnboarding,
} from "./actions";

export function ProviderShell({
  title,
  copy,
  children,
  notificationCount = 0,
  messageCount = 0,
}: {
  title: string;
  copy: string;
  children: React.ReactNode;
  notificationCount?: number;
  messageCount?: number;
}) {
  return (
    <main className="provider-shell">
      <header className="provider-topbar">
        <Link className="brand provider-brand" href="/">
          Golden Home Care
        </Link>
        <nav className="provider-nav" aria-label="Provider navigation">
          <Link href="/provider">Dashboard</Link>
          <Link href="/provider/profile">Profile</Link>
          <Link href="/provider/availability">Availability</Link>
          <Link className="notification-nav-link" href="/provider/messages">
            Messages
            {messageCount ? <span>{messageCount}</span> : null}
          </Link>
          <Link className="notification-nav-link" href="/account/notifications">
            Notifications
            {notificationCount ? <span>{notificationCount}</span> : null}
          </Link>
          <Link href="/providers">Public search</Link>
          <Link href="/account/payments">Payments</Link>
          <Link href="/account">Account</Link>
          <SignOutButton className="nav-link-button" />
        </nav>
      </header>
      <section className="provider-page-heading">
        <h1>{title}</h1>
        <p>{copy}</p>
      </section>
      {children}
    </main>
  );
}

export function ProviderStatusMessage({ status }: { status?: string }) {
  if (status === "invalid") {
    return (
      <p className="form-alert error full" role="alert">
        Please complete the required fields and check the highlighted choices.
      </p>
    );
  }

  if (status === "error") {
    return (
      <p className="form-alert error full" role="alert">
        We could not save your changes. Check your environment configuration and try again.
      </p>
    );
  }

  if (status === "saved") {
    return (
      <p className="form-alert success full" role="status">
        Your changes have been saved.
      </p>
    );
  }

  return null;
}

export function ProviderProfileForm({
  profile,
  mode,
  status,
}: {
  profile: ProviderProfileRecord | null;
  mode: "onboarding" | "profile";
  status?: string;
}) {
  const action = mode === "onboarding" ? saveProviderOnboarding : saveProviderProfile;
  const selectedServices = new Set(profile?.services.map((service) => service.serviceType) ?? []);

  return (
    <form className="form-card provider-profile-form" action={action}>
      <ProviderStatusMessage status={status} />
      <label>
        Name
        <input
          name="displayName"
          type="text"
          placeholder="Your public profile name"
          defaultValue={profile?.displayName ?? ""}
          autoComplete="name"
          required
        />
      </label>
      <label>
        Photo
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
      </label>
      {profile?.photoUrl ? (
        <div className="provider-photo-preview full">
          <Image src={profile.photoUrl} alt="" width={84} height={84} />
          <span>Current profile photo</span>
        </div>
      ) : null}
      <label>
        Email
        <input
          name="email"
          type="email"
          placeholder="you@example.com"
          defaultValue={profile?.email ?? ""}
          autoComplete="email"
          required
        />
      </label>
      <label>
        Phone
        <input
          name="phone"
          type="tel"
          placeholder="(555) 123-4567"
          defaultValue={profile?.phone ?? ""}
          autoComplete="tel"
          required
        />
      </label>
      <label>
        ZIP code
        <input
          name="zipCode"
          type="text"
          placeholder="Enter ZIP code"
          defaultValue={profile?.zipCode ?? ""}
          inputMode="numeric"
          autoComplete="postal-code"
          required
        />
      </label>
      <label>
        Service radius
        <input
          name="serviceRadiusMiles"
          type="number"
          min="1"
          max="100"
          step="1"
          placeholder="Miles"
          defaultValue={profile?.serviceRadiusMiles ?? 10}
          required
        />
      </label>
      <label>
        Hourly rate ($/hour)
        <input
          name="hourlyRate"
          type="number"
          min="1"
          max="250"
          step="1"
          placeholder="Enter your hourly rate"
          defaultValue={profile?.hourlyRateCents ? profile.hourlyRateCents / 100 : ""}
          required
        />
      </label>
      <label>
        Languages
        <input
          name="languages"
          type="text"
          placeholder="English, Spanish"
          defaultValue={profile?.languages.join(", ") ?? ""}
          required
        />
      </label>
      <fieldset className="checkbox-group full">
        <legend>Services offered</legend>
        {providerServiceOptions.map((option) => (
          <label key={option.value}>
            <input
              name="servicesOffered"
              type="checkbox"
              value={option.value}
              defaultChecked={selectedServices.has(option.value)}
            />
            <ServiceLabel
              label={option.label}
              serviceType={option.value}
              showSuggested={option.suggested}
              tooltipFocusable={false}
            />
          </label>
        ))}
      </fieldset>
      <label className="full">
        Short bio
        <textarea
          name="bio"
          placeholder="Share a warm, concise intro for families."
          rows={4}
          defaultValue={profile?.bio ?? ""}
          required
        />
      </label>
      <label className="full">
        Senior-care experience
        <textarea
          name="experienceSummary"
          placeholder="Describe relevant senior-care or support experience."
          rows={4}
          defaultValue={profile?.experienceSummary ?? ""}
          required
        />
      </label>
      <fieldset className="checkbox-group full">
        <legend>Provider details</legend>
        <label>
          <input
            name="transportationAvailable"
            type="checkbox"
            value="yes"
            defaultChecked={profile?.transportationAvailable ?? false}
          />
          <span>Transportation available</span>
        </label>
        <label>
          <input
            name="backgroundCheckWilling"
            type="checkbox"
            value="yes"
            defaultChecked={profile?.backgroundCheckWilling ?? false}
          />
          <span>Willing to complete background check</span>
        </label>
      </fieldset>
      <button className="button button-primary form-button full" type="submit">
        {mode === "onboarding" ? "Activate provider profile" : "Save profile"}
      </button>
    </form>
  );
}

export function ProviderAvailabilityForm({
  profile,
  status,
}: {
  profile: ProviderProfileRecord | null;
  status?: string;
}) {
  const windowsByDay = new Map(
    profile?.availabilityWindows.map((window) => [window.dayOfWeek, window]) ?? [],
  );
  const timezone = profile?.availabilityTimezone ?? defaultAvailabilityTimezone;
  const minimumNoticeMinutes = profile?.minimumNoticeMinutes ?? 120;
  const hasStructuredAvailability = Boolean(profile?.availabilityWindows.length);

  return (
    <form className="form-card provider-profile-form" action={saveProviderAvailability}>
      <ProviderStatusMessage status={status} />
      {!hasStructuredAvailability && profile?.availabilitySummary ? (
        <p className="availability-legacy-note full">
          Current availability note: {profile.availabilitySummary}
        </p>
      ) : null}
      <fieldset className="availability-schedule full">
        <legend>Weekly availability</legend>
        {availabilityDayOptions.map((day) => {
          const window = windowsByDay.get(day.value);

          return (
            <div className="availability-day-row" key={day.value}>
              <label className="availability-day-toggle">
                <input
                  name="availableDays"
                  type="checkbox"
                  value={day.value}
                  defaultChecked={Boolean(window)}
                />
                <span>{day.label}</span>
              </label>
              <label>
                <span>Start</span>
                <input
                  name={`startTime-${day.value}`}
                  type="time"
                  defaultValue={window?.startTime ?? "09:00"}
                />
              </label>
              <label>
                <span>End</span>
                <input
                  name={`endTime-${day.value}`}
                  type="time"
                  defaultValue={window?.endTime ?? "12:00"}
                />
              </label>
            </div>
          );
        })}
      </fieldset>
      <label>
        Timezone
        <select name="availabilityTimezone" defaultValue={timezone}>
          {availabilityTimezoneOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Minimum notice
        <select name="minimumNoticeMinutes" defaultValue={minimumNoticeMinutes}>
          {minimumNoticeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="checkbox-group full">
        <legend>On-demand requests</legend>
        <label>
          <input
            name="onDemandAvailable"
            type="checkbox"
            value="yes"
            defaultChecked={profile?.onDemandAvailable ?? false}
          />
          <span>Accept on-demand requests during available windows</span>
        </label>
      </fieldset>
      <button className="button button-primary form-button full" type="submit">
        Save availability
      </button>
    </form>
  );
}

export function ProviderDashboardCards({ profile }: { profile: ProviderProfileRecord | null }) {
  const isActive = profile?.status === "active";
  const publicSearchHref = profile?.zipCode ? `/providers?zip=${profile.zipCode}` : "/providers";
  const hasAvailability = Boolean(profile?.availabilityWindows.length || profile?.availabilitySummary);
  const stripeReady = Boolean(
    profile?.stripeAccountId &&
      profile.stripeChargesEnabled &&
      profile.stripePayoutsEnabled &&
      profile.stripeOnboardingComplete,
  );

  return (
    <div className="provider-dashboard-grid">
      <article className="provider-summary-card">
        <UserRound size={26} />
        <span>Status</span>
        <strong>{profile?.status ?? "draft"}</strong>
        <p>{isActive ? "Your profile can appear in public search." : "Complete onboarding to publish your profile."}</p>
      </article>
      <article className="provider-summary-card">
        <BadgeCheck size={26} />
        <span>Services</span>
        <strong>{profile?.services.length ?? 0}</strong>
        <p>{profile?.services.map((service) => service.label).join(", ") || "No services selected yet."}</p>
      </article>
      <article className="provider-summary-card">
        <CalendarCheck2 size={26} />
        <span>Availability</span>
        <strong>{hasAvailability ? "Set" : "Missing"}</strong>
        <p>{profile?.availabilitySummary || "Add weekly availability windows."}</p>
      </article>
      <article className="provider-summary-card">
        <Search size={26} />
        <span>Public listing</span>
        <strong>{isActive ? "Live" : "Hidden"}</strong>
        <p>{isActive ? <Link href={publicSearchHref}>View in search</Link> : <Link href="/provider/onboarding">Finish onboarding</Link>}</p>
      </article>
      <article className="provider-summary-card">
        <CreditCard size={26} />
        <span>Payments</span>
        <strong>{stripeReady ? "Ready" : "Setup"}</strong>
        {stripeReady ? (
          <p>
            <Link href="/account/payments">Manage payouts</Link>
          </p>
        ) : (
          <form action={startStripeProviderOnboarding}>
            <button className="nav-link-button provider-card-action" type="submit">
              {profile?.stripeAccountId ? "Finish Stripe setup" : "Set up Stripe"}
            </button>
          </form>
        )}
      </article>
      <article className="provider-summary-card provider-summary-card-wide">
        <MessageCircle size={26} />
        <span>Requests</span>
        <strong>Inbox</strong>
        <p>
          <Link href="/provider/messages">Review incoming service requests</Link>
        </p>
      </article>
    </div>
  );
}
