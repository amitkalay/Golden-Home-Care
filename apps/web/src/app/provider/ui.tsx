import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, CalendarCheck2, MessageCircle, Search, UserRound } from "lucide-react";
import { providerServiceOptions } from "./services.js";
import type { ProviderProfileRecord } from "./db";
import {
  saveProviderAvailability,
  saveProviderOnboarding,
  saveProviderProfile,
} from "./actions";

export function ProviderShell({
  title,
  copy,
  children,
}: {
  title: string;
  copy: string;
  children: React.ReactNode;
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
          <Link href="/provider/messages">Messages</Link>
          <Link href="/providers">Public search</Link>
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
        Please complete the required fields and select at least one service.
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
        Your provider profile has been saved.
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
            <span>{option.label}</span>
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
      <label className="full">
        Availability summary
        <textarea
          name="availabilitySummary"
          placeholder="Example: Weekday mornings and Sunday afternoons."
          rows={3}
          defaultValue={profile?.availabilitySummary ?? ""}
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
  return (
    <form className="form-card provider-profile-form" action={saveProviderAvailability}>
      <ProviderStatusMessage status={status} />
      <label className="full">
        Availability summary
        <textarea
          name="availabilitySummary"
          placeholder="Example: Weekday mornings and Sunday afternoons."
          rows={5}
          defaultValue={profile?.availabilitySummary ?? ""}
          required
        />
      </label>
      <fieldset className="checkbox-group full">
        <legend>Availability details</legend>
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
        Save availability
      </button>
    </form>
  );
}

export function ProviderDashboardCards({ profile }: { profile: ProviderProfileRecord | null }) {
  const isActive = profile?.status === "active";
  const publicSearchHref = profile?.zipCode ? `/providers?zip=${profile.zipCode}` : "/providers";

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
        <strong>{profile?.availabilitySummary ? "Set" : "Missing"}</strong>
        <p>{profile?.availabilitySummary || "Add a short availability summary."}</p>
      </article>
      <article className="provider-summary-card">
        <Search size={26} />
        <span>Public listing</span>
        <strong>{isActive ? "Live" : "Hidden"}</strong>
        <p>{isActive ? <Link href={publicSearchHref}>View in search</Link> : <Link href="/provider/onboarding">Finish onboarding</Link>}</p>
      </article>
      <article className="provider-summary-card provider-summary-card-wide">
        <MessageCircle size={26} />
        <span>Messages</span>
        <strong>Not yet enabled</strong>
        <p>Family messaging will connect here after the marketplace flow is ready.</p>
      </article>
    </div>
  );
}

