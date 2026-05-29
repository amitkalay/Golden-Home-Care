import Link from "next/link";
import { Home } from "lucide-react";
import { requireUser } from "../../lib/auth";
import { getUserAccount } from "../../account/db";
import { providerServiceValues } from "../../provider/services.js";
import { getActiveRequestProviderTarget } from "../db";
import { createServiceRequest } from "../actions";
import { getTodayDateString } from "../validation.js";
import { RequestServiceForm } from "./request-service-form";

export const dynamic = "force-dynamic";

type NewRequestPageProps = {
  searchParams?: Promise<{
    providerId?: string | string[];
    service?: string | string[];
    zip?: string | string[];
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

function buildProviderSearchHref({ service, zip }: { service?: string; zip?: string }) {
  const params = new URLSearchParams();

  if (service) params.set("service", service);
  if (zip) params.set("zip", zip);

  const query = params.toString();
  return query ? `/providers?${query}` : "/providers";
}

export default async function NewServiceRequestPage({ searchParams }: NewRequestPageProps) {
  const user = await requireUser();
  const account = await getUserAccount(user.id);
  const params = searchParams ? await searchParams : {};
  const providerId = parseProviderId(getParam(params.providerId));
  const requestedService = getParam(params.service);
  const requestedZip = getParam(params.zip);
  const provider = providerId ? await getActiveRequestProviderTarget(providerId) : null;
  const providerServiceTypes = new Set(provider?.services.map((service) => service.serviceType) ?? []);
  const selectedService =
    requestedService &&
    providerServiceValues.includes(requestedService) &&
    (!provider || providerServiceTypes.has(requestedService))
      ? requestedService
      : provider?.services[0]?.serviceType ?? "";
  const selectedZip = requestedZip && /^\d{5}$/.test(requestedZip) ? requestedZip : provider?.zipCode ?? "";
  const contactName = account?.name || user.name || "";
  const contactEmail = account?.email || user.email || "";
  const providerSearchHref = buildProviderSearchHref({
    service: selectedService || requestedService,
    zip: selectedZip || requestedZip,
  });

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
        <p>Choose a provider, then request a time they can support.</p>
      </section>

      {!provider ? (
        <section className="provider-empty-state">
          <h2>Select a provider first</h2>
          <p>Service requests must be sent to a specific available provider.</p>
          <Link className="button button-primary" href={providerSearchHref}>
            Find providers
          </Link>
        </section>
      ) : (
        <RequestServiceForm
          action={createServiceRequest}
          contactEmail={contactEmail}
          contactName={contactName}
          initialService={selectedService}
          initialZip={selectedZip}
          nowIso={new Date().toISOString()}
          provider={provider}
          today={getTodayDateString(provider.availabilityTimezone)}
        />
      )}
    </main>
  );
}
