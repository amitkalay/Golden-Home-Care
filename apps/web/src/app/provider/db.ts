import { getSql, ensureProviderTables } from "../lib/database";
import { geocodeZipCode } from "../lib/zip-geocode";
import { filterProviderSearchResults } from "../providers/search.js";
import { providerServiceLabels, providerServiceValues } from "./services.js";

export type ProviderProfileRecord = {
  id: number;
  userId: string;
  displayName: string | null;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  serviceRadiusMiles: number | null;
  hourlyRateCents: number | null;
  bio: string | null;
  experienceSummary: string | null;
  languages: string[];
  availabilitySummary: string | null;
  transportationAvailable: boolean;
  backgroundCheckWilling: boolean;
  status: string;
  services: Array<{ serviceType: string; label: string }>;
};

type ProviderProfileInput = {
  displayName: string;
  email: string;
  phone: string;
  zipCode: string;
  serviceRadiusMiles: number;
  hourlyRateCents: number;
  bio: string;
  experienceSummary: string;
  languages: string[];
  availabilitySummary: string;
  transportationAvailable: boolean;
  backgroundCheckWilling: boolean;
  servicesOffered: string[];
};

type ProviderAvailabilityInput = {
  availabilitySummary: string;
  transportationAvailable: boolean;
  backgroundCheckWilling: boolean;
};

function toRecord(row: Record<string, unknown>): ProviderProfileRecord {
  const services = Array.isArray(row.services) ? row.services : [];

  return {
    id: Number(row.id),
    userId: String(row.userId),
    displayName: (row.displayName as string | null) ?? null,
    photoUrl: (row.photoUrl as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    zipCode: (row.zipCode as string | null) ?? null,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    serviceRadiusMiles: row.serviceRadiusMiles === null ? null : Number(row.serviceRadiusMiles),
    hourlyRateCents: row.hourlyRateCents === null ? null : Number(row.hourlyRateCents),
    bio: (row.bio as string | null) ?? null,
    experienceSummary: (row.experienceSummary as string | null) ?? null,
    languages: Array.isArray(row.languages) ? (row.languages as string[]) : [],
    availabilitySummary: (row.availabilitySummary as string | null) ?? null,
    transportationAvailable: Boolean(row.transportationAvailable),
    backgroundCheckWilling: Boolean(row.backgroundCheckWilling),
    status: String(row.status),
    services: services
      .filter((service): service is { serviceType: string } => {
        return (
          typeof service === "object" &&
          service !== null &&
          typeof (service as { serviceType?: unknown }).serviceType === "string"
        );
      })
      .map((service) => ({
        serviceType: service.serviceType,
        label: providerServiceLabels.get(service.serviceType) ?? service.serviceType,
      })),
  };
}

export async function ensureDraftProviderProfile(userId: string, displayName?: string | null, photoUrl?: string | null) {
  const sql = getSql();

  await ensureProviderTables();
  await sql`
    INSERT INTO provider_profiles (user_id, display_name, photo_url, status)
    VALUES (${userId}, ${displayName || null}, ${photoUrl || null}, 'draft')
    ON CONFLICT (user_id) DO NOTHING
  `;
}

export async function getProviderProfileByUserId(userId: string) {
  const sql = getSql();

  await ensureProviderTables();
  const rows = await sql`
    SELECT
      p.id,
      p.user_id as "userId",
      p.display_name as "displayName",
      p.photo_url as "photoUrl",
      u.email,
      p.phone,
      p.zip_code as "zipCode",
      p.latitude,
      p.longitude,
      p.service_radius_miles as "serviceRadiusMiles",
      p.hourly_rate_cents as "hourlyRateCents",
      p.bio,
      p.experience_summary as "experienceSummary",
      p.languages,
      p.availability_summary as "availabilitySummary",
      p.transportation_available as "transportationAvailable",
      p.background_check_willing as "backgroundCheckWilling",
      p.status,
      COALESCE(
        json_agg(json_build_object('serviceType', ps.service_type))
          FILTER (WHERE ps.id IS NOT NULL),
        '[]'
      ) as services
    FROM provider_profiles p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN provider_services ps ON ps.provider_profile_id = p.id
    WHERE p.user_id = ${userId}
    GROUP BY p.id, u.email
  `;

  const records = rows as Array<Record<string, unknown>>;
  return records[0] ? toRecord(records[0]) : null;
}

export async function saveProviderProfile(userId: string, input: ProviderProfileInput, photoUrl: string | null) {
  const sql = getSql();
  const location = await geocodeZipCode(input.zipCode);

  await ensureProviderTables();
  await sql`
    UPDATE users
    SET name = ${input.displayName}, email = ${input.email}
    WHERE id = ${userId}
  `;

  const rows = await sql`
    INSERT INTO provider_profiles (
      user_id,
      display_name,
      photo_url,
      phone,
      zip_code,
      latitude,
      longitude,
      service_radius_miles,
      hourly_rate_cents,
      bio,
      experience_summary,
      languages,
      availability_summary,
      transportation_available,
      background_check_willing,
      status,
      updated_at
    )
    VALUES (
      ${userId},
      ${input.displayName},
      ${photoUrl},
      ${input.phone},
      ${input.zipCode},
      ${location?.latitude ?? null},
      ${location?.longitude ?? null},
      ${input.serviceRadiusMiles},
      ${input.hourlyRateCents},
      ${input.bio},
      ${input.experienceSummary},
      ${input.languages},
      ${input.availabilitySummary},
      ${input.transportationAvailable},
      ${input.backgroundCheckWilling},
      'active',
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      photo_url = COALESCE(EXCLUDED.photo_url, provider_profiles.photo_url),
      phone = EXCLUDED.phone,
      zip_code = EXCLUDED.zip_code,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      service_radius_miles = EXCLUDED.service_radius_miles,
      hourly_rate_cents = EXCLUDED.hourly_rate_cents,
      bio = EXCLUDED.bio,
      experience_summary = EXCLUDED.experience_summary,
      languages = EXCLUDED.languages,
      availability_summary = EXCLUDED.availability_summary,
      transportation_available = EXCLUDED.transportation_available,
      background_check_willing = EXCLUDED.background_check_willing,
      status = 'active',
      updated_at = now()
    RETURNING id
  `;

  const records = rows as Array<Record<string, unknown>>;
  const profileId = Number(records[0].id);
  await sql`DELETE FROM provider_services WHERE provider_profile_id = ${profileId}`;

  for (const serviceType of input.servicesOffered) {
    await sql`
      INSERT INTO provider_services (provider_profile_id, service_type)
      VALUES (${profileId}, ${serviceType})
      ON CONFLICT (provider_profile_id, service_type) DO NOTHING
    `;
  }
}

export async function saveProviderAvailability(userId: string, input: ProviderAvailabilityInput) {
  const sql = getSql();

  await ensureProviderTables();
  await sql`
    UPDATE provider_profiles
    SET
      availability_summary = ${input.availabilitySummary},
      transportation_available = ${input.transportationAvailable},
      background_check_willing = ${input.backgroundCheckWilling},
      updated_at = now()
    WHERE user_id = ${userId}
  `;
}

export async function searchProviderProfiles({
  zipCode,
  service,
}: {
  zipCode?: string;
  service?: string;
}) {
  const sql = getSql();
  const normalizedService = service && providerServiceValues.includes(service) ? service : "";
  const hasZipFilter = Boolean(zipCode?.trim());
  const location = hasZipFilter ? await geocodeZipCode(zipCode ?? "") : null;

  if (hasZipFilter && !location) {
    return { providers: [] as ProviderProfileRecord[], invalidZip: true };
  }

  await ensureProviderTables();
  const rows = await sql`
    SELECT
      p.id,
      p.user_id as "userId",
      p.display_name as "displayName",
      p.photo_url as "photoUrl",
      u.email,
      p.phone,
      p.zip_code as "zipCode",
      p.latitude,
      p.longitude,
      p.service_radius_miles as "serviceRadiusMiles",
      p.hourly_rate_cents as "hourlyRateCents",
      p.bio,
      p.experience_summary as "experienceSummary",
      p.languages,
      p.availability_summary as "availabilitySummary",
      p.transportation_available as "transportationAvailable",
      p.background_check_willing as "backgroundCheckWilling",
      p.status,
      COALESCE(
        json_agg(json_build_object('serviceType', ps.service_type))
          FILTER (WHERE ps.id IS NOT NULL),
        '[]'
      ) as services
    FROM provider_profiles p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN provider_services ps ON ps.provider_profile_id = p.id
    WHERE p.status = 'active'
    GROUP BY p.id, u.email
    ORDER BY p.updated_at DESC
  `;

  const providers = (rows as Array<Record<string, unknown>>).map((row) => toRecord(row));

  return {
    providers: filterProviderSearchResults(providers, {
      service: normalizedService,
      location,
    }) as ProviderProfileRecord[],
    invalidZip: false,
  };
}
