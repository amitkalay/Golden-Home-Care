import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Car, Languages, MapPin, Search } from "lucide-react";
import { providerServiceOptions } from "../provider/services.js";
import { searchProviderProfiles } from "../provider/db";

export const dynamic = "force-dynamic";

type ProvidersPageProps = {
  searchParams?: Promise<{
    zip?: string | string[];
    service?: string | string[];
  }>;
};

function formatRate(rateCents: number | null) {
  if (!rateCents) return "Rate pending";
  return `$${Math.round(rateCents / 100)}/hr`;
}

export default async function ProvidersPage({ searchParams }: ProvidersPageProps) {
  const params = searchParams ? await searchParams : {};
  const zip = Array.isArray(params.zip) ? params.zip[0] : params.zip;
  const service = Array.isArray(params.service) ? params.service[0] : params.service;
  let providers: Awaited<ReturnType<typeof searchProviderProfiles>>["providers"] = [];
  let invalidZip = false;
  let searchError = false;

  try {
    const searchResults = await searchProviderProfiles({ zipCode: zip, service });
    providers = searchResults.providers;
    invalidZip = searchResults.invalidZip;
  } catch (error) {
    console.error("Failed to load provider search", error);
    searchError = true;
  }

  return (
    <main className="provider-search-shell">
      <header className="provider-topbar">
        <Link className="brand provider-brand" href="/">
          Golden Home Care
        </Link>
        <nav className="provider-nav" aria-label="Primary navigation">
          <Link href="/">Home</Link>
          <Link href="/sign-in">Provider sign in</Link>
        </nav>
      </header>
      <section className="provider-page-heading">
        <h1>Search provider profiles</h1>
        <p>Browse active local providers, rates, services, and service coverage.</p>
      </section>
      <form className="provider-search-form">
        <label>
          ZIP code
          <input name="zip" type="text" placeholder="94107" defaultValue={zip ?? ""} inputMode="numeric" />
        </label>
        <label>
          Service
          <select name="service" defaultValue={service ?? ""}>
            <option value="">All services</option>
            {providerServiceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button className="button button-primary" type="submit">
          <Search size={18} />
          Search
        </button>
      </form>
      {invalidZip ? (
        <p className="form-alert error" role="alert">
          Enter a valid 5-digit US ZIP code to search by coverage area.
        </p>
      ) : null}
      {searchError ? (
        <p className="form-alert error" role="alert">
          Provider search is not connected to the database yet. Configure DATABASE_URL to show active profiles.
        </p>
      ) : null}
      <section className="provider-results" aria-label="Provider profiles">
        {providers.length ? (
          providers.map((provider) => (
            <article className="public-provider-card" key={provider.id}>
              <div className="public-provider-photo">
                {provider.photoUrl ? (
                  <Image src={provider.photoUrl} alt="" fill sizes="120px" />
                ) : (
                  <span>{provider.displayName?.slice(0, 1) ?? "G"}</span>
                )}
              </div>
              <div className="public-provider-main">
                <div className="public-provider-heading">
                  <div>
                    <h2>{provider.displayName}</h2>
                    <p>
                      <MapPin size={16} /> ZIP {provider.zipCode} · {provider.serviceRadiusMiles} mile radius
                    </p>
                  </div>
                  <strong>{formatRate(provider.hourlyRateCents)}</strong>
                </div>
                <p>{provider.bio}</p>
                <div className="provider-chip-row">
                  {provider.services.map((item) => (
                    <span key={item.serviceType}>{item.label}</span>
                  ))}
                </div>
                <dl className="provider-profile-facts">
                  <div>
                    <dt>
                      <Languages size={16} /> Languages
                    </dt>
                    <dd>{provider.languages.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>
                      <BadgeCheck size={16} /> Experience
                    </dt>
                    <dd>{provider.experienceSummary}</dd>
                  </div>
                  <div>
                    <dt>
                      <Search size={16} /> Availability
                    </dt>
                    <dd>{provider.availabilitySummary}</dd>
                  </div>
                  <div>
                    <dt>
                      <Car size={16} /> Transportation
                    </dt>
                    <dd>{provider.transportationAvailable ? "Available" : "Not listed"}</dd>
                  </div>
                </dl>
                <p className="background-check-note">
                  {provider.backgroundCheckWilling
                    ? "Willing to complete a background check."
                    : "Background-check willingness not listed."}
                </p>
              </div>
            </article>
          ))
        ) : (
          <section className="provider-empty-state">
            <h2>No active providers found</h2>
            <p>Try a different ZIP code or service, or check back as more provider profiles go live.</p>
          </section>
        )}
      </section>
    </main>
  );
}
