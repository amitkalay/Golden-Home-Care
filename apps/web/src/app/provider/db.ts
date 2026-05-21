import { getPool, getSql, ensureProviderTables, ensureServiceRequestTables } from "../lib/database";
import { geocodeZipCode } from "../lib/zip-geocode";
import { filterProviderSearchResults } from "../providers/search.js";
import { defaultAvailabilityTimezone, generateAvailabilitySummary } from "./profile-validation.js";
import { providerServiceLabels, providerServiceValues } from "./services.js";

export type ProviderAvailabilityWindowRecord = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

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
  availabilityTimezone: string;
  onDemandAvailable: boolean;
  minimumNoticeMinutes: number;
  availabilityWindows: ProviderAvailabilityWindowRecord[];
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
  transportationAvailable: boolean;
  backgroundCheckWilling: boolean;
  servicesOffered: string[];
};

type ProviderAvailabilityInput = {
  windows: ProviderAvailabilityWindowRecord[];
  availabilitySummary: string;
  availabilityTimezone: string;
  onDemandAvailable: boolean;
  minimumNoticeMinutes: number;
};

export type ProviderRequestMatchStatus = "pending" | "proposed" | "accepted" | "declined" | "expired";

export type ProviderRequestInboxRecord = {
  matchId: number;
  requestId: number;
  matchStatus: ProviderRequestMatchStatus;
  matchSource: "weekly" | "on_demand";
  distanceMiles: number | null;
  serviceType: string;
  serviceLabel: string;
  zipCode: string;
  requestedDate: string;
  windowStartTime: string;
  windowEndTime: string;
  durationMinutes: number;
  urgency: "urgent" | "soon" | "flexible";
  notes: string | null;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  proposedDate: string | null;
  proposedStartTime: string | null;
  proposedEndTime: string | null;
  providerResponseNote: string | null;
  respondedAt: Date | null;
  createdAt: Date | null;
};

type ProviderProposalInput = {
  proposedDate: string;
  proposedStartTime: string;
  proposedEndTime: string;
  providerResponseNote: string;
};

function toRecord(row: Record<string, unknown>): ProviderProfileRecord {
  const services = Array.isArray(row.services) ? row.services : [];
  const availabilityWindows = Array.isArray(row.availabilityWindows) ? row.availabilityWindows : [];
  const normalizedAvailabilityWindows = availabilityWindows
    .filter((window): window is ProviderAvailabilityWindowRecord => {
      return (
        typeof window === "object" &&
        window !== null &&
        Number.isInteger(Number((window as { dayOfWeek?: unknown }).dayOfWeek)) &&
        typeof (window as { startTime?: unknown }).startTime === "string" &&
        typeof (window as { endTime?: unknown }).endTime === "string"
      );
    })
    .map((window) => ({
      dayOfWeek: Number(window.dayOfWeek),
      startTime: window.startTime,
      endTime: window.endTime,
    }));
  const availabilityTimezone = (row.availabilityTimezone as string | null) ?? defaultAvailabilityTimezone;
  const minimumNoticeMinutes = row.minimumNoticeMinutes === null ? 120 : Number(row.minimumNoticeMinutes);
  const generatedAvailabilitySummary = generateAvailabilitySummary({
    windows: normalizedAvailabilityWindows,
    timezone: availabilityTimezone,
    onDemandAvailable: Boolean(row.onDemandAvailable),
    minimumNoticeMinutes,
  });
  const availabilitySummary =
    (row.availabilitySummary as string | null) ?? (generatedAvailabilitySummary || null);

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
    availabilitySummary,
    availabilityTimezone,
    onDemandAvailable: Boolean(row.onDemandAvailable),
    minimumNoticeMinutes,
    availabilityWindows: normalizedAvailabilityWindows,
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

function normalizeProviderRequestStatus(status: unknown): ProviderRequestMatchStatus {
  if (
    status === "proposed" ||
    status === "accepted" ||
    status === "declined" ||
    status === "expired"
  ) {
    return status;
  }

  return "pending";
}

function toProviderRequestInboxRecord(row: Record<string, unknown>): ProviderRequestInboxRecord {
  const urgency = row.urgency === "urgent" || row.urgency === "flexible" ? row.urgency : "soon";
  const matchSource = row.matchSource === "on_demand" ? "on_demand" : "weekly";
  const serviceType = String(row.serviceType);

  return {
    matchId: Number(row.matchId),
    requestId: Number(row.requestId),
    matchStatus: normalizeProviderRequestStatus(row.matchStatus),
    matchSource,
    distanceMiles: row.distanceMiles === null ? null : Number(row.distanceMiles),
    serviceType,
    serviceLabel: providerServiceLabels.get(serviceType) ?? serviceType,
    zipCode: String(row.zipCode),
    requestedDate: String(row.requestedDate),
    windowStartTime: String(row.windowStartTime),
    windowEndTime: String(row.windowEndTime),
    durationMinutes: Number(row.durationMinutes),
    urgency,
    notes: (row.notes as string | null) ?? null,
    contactName: String(row.contactName),
    contactEmail: (row.contactEmail as string | null) ?? null,
    contactPhone: (row.contactPhone as string | null) ?? null,
    proposedDate: (row.proposedDate as string | null) ?? null,
    proposedStartTime: (row.proposedStartTime as string | null) ?? null,
    proposedEndTime: (row.proposedEndTime as string | null) ?? null,
    providerResponseNote: (row.providerResponseNote as string | null) ?? null,
    respondedAt: (row.respondedAt as Date | null) ?? null,
    createdAt: (row.createdAt as Date | null) ?? null,
  };
}

export async function ensureDraftProviderProfile(userId: string, displayName?: string | null) {
  const sql = getSql();

  await ensureProviderTables();
  await sql`
    UPDATE users
    SET role = 'provider', updated_at = now()
    WHERE id = ${userId} AND role <> 'provider'
  `;
  await sql`
    INSERT INTO provider_profiles (user_id, display_name, status)
    VALUES (${userId}, ${displayName || null}, 'draft')
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
      COALESCE(p.contact_email, u.email) as email,
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
      p.availability_timezone as "availabilityTimezone",
      p.on_demand_available as "onDemandAvailable",
      p.minimum_notice_minutes as "minimumNoticeMinutes",
      p.transportation_available as "transportationAvailable",
      p.background_check_willing as "backgroundCheckWilling",
      p.status,
      COALESCE(
        (
          SELECT json_agg(json_build_object('serviceType', ps.service_type) ORDER BY ps.service_type)
          FROM provider_services ps
          WHERE ps.provider_profile_id = p.id
        ),
        '[]'
      ) as services,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'dayOfWeek', paw.day_of_week,
              'startTime', to_char(paw.start_time, 'HH24:MI'),
              'endTime', to_char(paw.end_time, 'HH24:MI')
            )
            ORDER BY paw.day_of_week, paw.start_time
          )
          FROM provider_availability_windows paw
          WHERE paw.provider_profile_id = p.id
        ),
        '[]'
      ) as "availabilityWindows"
    FROM provider_profiles p
    JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ${userId}
  `;

  const records = rows as Array<Record<string, unknown>>;
  return records[0] ? toRecord(records[0]) : null;
}

export async function saveProviderProfile(userId: string, input: ProviderProfileInput, photoUrl: string | null) {
  const sql = getSql();
  const location = await geocodeZipCode(input.zipCode);

  await ensureProviderTables();

  const rows = await sql`
    INSERT INTO provider_profiles (
      user_id,
      display_name,
      photo_url,
      contact_email,
      phone,
      zip_code,
      latitude,
      longitude,
      service_radius_miles,
      hourly_rate_cents,
      bio,
      experience_summary,
      languages,
      transportation_available,
      background_check_willing,
      status,
      updated_at
    )
    VALUES (
      ${userId},
      ${input.displayName},
      ${photoUrl},
      ${input.email},
      ${input.phone},
      ${input.zipCode},
      ${location?.latitude ?? null},
      ${location?.longitude ?? null},
      ${input.serviceRadiusMiles},
      ${input.hourlyRateCents},
      ${input.bio},
      ${input.experienceSummary},
      ${input.languages},
      ${input.transportationAvailable},
      ${input.backgroundCheckWilling},
      'active',
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      photo_url = COALESCE(EXCLUDED.photo_url, provider_profiles.photo_url),
      contact_email = EXCLUDED.contact_email,
      phone = EXCLUDED.phone,
      zip_code = EXCLUDED.zip_code,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      service_radius_miles = EXCLUDED.service_radius_miles,
      hourly_rate_cents = EXCLUDED.hourly_rate_cents,
      bio = EXCLUDED.bio,
      experience_summary = EXCLUDED.experience_summary,
      languages = EXCLUDED.languages,
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
  const rows = await sql`
    UPDATE provider_profiles
    SET
      availability_summary = ${input.availabilitySummary},
      availability_timezone = ${input.availabilityTimezone},
      on_demand_available = ${input.onDemandAvailable},
      minimum_notice_minutes = ${input.minimumNoticeMinutes},
      updated_at = now()
    WHERE user_id = ${userId}
    RETURNING id
  `;

  const records = rows as Array<Record<string, unknown>>;
  const profileId = records[0] ? Number(records[0].id) : null;

  if (!profileId) return;

  await sql`DELETE FROM provider_availability_windows WHERE provider_profile_id = ${profileId}`;

  for (const window of input.windows) {
    await sql`
      INSERT INTO provider_availability_windows (provider_profile_id, day_of_week, start_time, end_time)
      VALUES (${profileId}, ${window.dayOfWeek}, ${window.startTime}, ${window.endTime})
      ON CONFLICT (provider_profile_id, day_of_week) DO UPDATE SET
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        updated_at = now()
    `;
  }
}

export async function getProviderRequestInbox(userId: string) {
  const sql = getSql();

  await ensureServiceRequestTables();
  const rows = await sql`
    SELECT
      rpm.id as "matchId",
      sr.id as "requestId",
      rpm.status as "matchStatus",
      rpm.match_source as "matchSource",
      rpm.distance_miles as "distanceMiles",
      sr.service_type as "serviceType",
      sr.zip_code as "zipCode",
      to_char(sr.requested_date, 'YYYY-MM-DD') as "requestedDate",
      to_char(sr.window_start_time, 'HH24:MI') as "windowStartTime",
      to_char(sr.window_end_time, 'HH24:MI') as "windowEndTime",
      sr.duration_minutes as "durationMinutes",
      sr.urgency,
      sr.notes,
      sr.contact_name as "contactName",
      CASE WHEN rpm.status = 'accepted' THEN sr.contact_email ELSE NULL END as "contactEmail",
      CASE WHEN rpm.status = 'accepted' THEN sr.contact_phone ELSE NULL END as "contactPhone",
      to_char(rpm.proposed_date, 'YYYY-MM-DD') as "proposedDate",
      to_char(rpm.proposed_start_time, 'HH24:MI') as "proposedStartTime",
      to_char(rpm.proposed_end_time, 'HH24:MI') as "proposedEndTime",
      rpm.provider_response_note as "providerResponseNote",
      rpm.responded_at as "respondedAt",
      rpm.created_at as "createdAt"
    FROM request_provider_matches rpm
    JOIN provider_profiles p ON p.id = rpm.provider_profile_id
    JOIN service_requests sr ON sr.id = rpm.service_request_id
    WHERE p.user_id = ${userId}
    ORDER BY
      CASE rpm.status
        WHEN 'pending' THEN 0
        WHEN 'proposed' THEN 1
        WHEN 'accepted' THEN 2
        WHEN 'declined' THEN 3
        ELSE 4
      END,
      sr.requested_date ASC,
      sr.window_start_time ASC,
      rpm.created_at DESC
  `;

  return (rows as Array<Record<string, unknown>>).map((row) => toProviderRequestInboxRecord(row));
}

export async function acceptProviderRequestMatch(userId: string, matchId: number) {
  const pool = getPool();
  const client = await pool.connect();
  let didBegin = false;

  await ensureServiceRequestTables();

  try {
    await client.query("BEGIN");
    didBegin = true;
    const result = await client.query(
      `
        UPDATE request_provider_matches rpm
        SET
          status = 'accepted',
          proposed_date = NULL,
          proposed_start_time = NULL,
          proposed_end_time = NULL,
          provider_response_note = NULL,
          responded_at = now(),
          updated_at = now()
        FROM provider_profiles p
        WHERE rpm.id = $1
          AND rpm.provider_profile_id = p.id
          AND p.user_id = $2
          AND rpm.status = 'pending'
        RETURNING rpm.service_request_id
      `,
      [matchId, userId],
    );
    const serviceRequestId = result.rows[0]?.service_request_id;

    if (!serviceRequestId) {
      await client.query("ROLLBACK");
      didBegin = false;
      return false;
    }

    await client.query(
      `
        UPDATE request_provider_matches
        SET
          status = 'expired',
          responded_at = COALESCE(responded_at, now()),
          updated_at = now()
        WHERE service_request_id = $1
          AND id <> $2
          AND status in ('pending', 'proposed')
      `,
      [serviceRequestId, matchId],
    );

    await client.query("COMMIT");
    didBegin = false;
    return true;
  } catch (error) {
    if (didBegin) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function declineProviderRequestMatch(userId: string, matchId: number) {
  const sql = getSql();

  await ensureServiceRequestTables();
  const rows = await sql`
    UPDATE request_provider_matches rpm
    SET
      status = 'declined',
      proposed_date = NULL,
      proposed_start_time = NULL,
      proposed_end_time = NULL,
      provider_response_note = NULL,
      responded_at = now(),
      updated_at = now()
    FROM provider_profiles p
    WHERE rpm.id = ${matchId}
      AND rpm.provider_profile_id = p.id
      AND p.user_id = ${userId}
      AND rpm.status = 'pending'
    RETURNING rpm.id
  `;
  const records = rows as Array<Record<string, unknown>>;

  return records.length > 0;
}

export async function proposeProviderRequestTime(
  userId: string,
  matchId: number,
  input: ProviderProposalInput,
) {
  const sql = getSql();

  await ensureServiceRequestTables();
  const rows = await sql`
    UPDATE request_provider_matches rpm
    SET
      status = 'proposed',
      proposed_date = ${input.proposedDate},
      proposed_start_time = ${input.proposedStartTime},
      proposed_end_time = ${input.proposedEndTime},
      provider_response_note = ${input.providerResponseNote || null},
      responded_at = now(),
      updated_at = now()
    FROM provider_profiles p
    WHERE rpm.id = ${matchId}
      AND rpm.provider_profile_id = p.id
      AND p.user_id = ${userId}
      AND rpm.status = 'pending'
    RETURNING rpm.id
  `;
  const records = rows as Array<Record<string, unknown>>;

  return records.length > 0;
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
      COALESCE(p.contact_email, u.email) as email,
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
      p.availability_timezone as "availabilityTimezone",
      p.on_demand_available as "onDemandAvailable",
      p.minimum_notice_minutes as "minimumNoticeMinutes",
      p.transportation_available as "transportationAvailable",
      p.background_check_willing as "backgroundCheckWilling",
      p.status,
      COALESCE(
        (
          SELECT json_agg(json_build_object('serviceType', ps.service_type) ORDER BY ps.service_type)
          FROM provider_services ps
          WHERE ps.provider_profile_id = p.id
        ),
        '[]'
      ) as services,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'dayOfWeek', paw.day_of_week,
              'startTime', to_char(paw.start_time, 'HH24:MI'),
              'endTime', to_char(paw.end_time, 'HH24:MI')
            )
            ORDER BY paw.day_of_week, paw.start_time
          )
          FROM provider_availability_windows paw
          WHERE paw.provider_profile_id = p.id
        ),
        '[]'
      ) as "availabilityWindows"
    FROM provider_profiles p
    JOIN users u ON u.id = p.user_id
    WHERE p.status = 'active'
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
