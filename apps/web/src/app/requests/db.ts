import { ensureServiceRequestTables, getPool, getSql } from "../lib/database";
import { providerServiceLabels } from "../provider/services.js";
import { findRequestProviderMatches } from "./matching.js";

export type RequestProviderTarget = {
  id: number;
  displayName: string | null;
  zipCode: string | null;
  services: Array<{ serviceType: string; label: string }>;
};

export type ServiceRequestRecord = {
  id: number;
  requesterUserId: string;
  providerProfileId: number | null;
  providerDisplayName: string | null;
  matchPreference: "any" | "specific";
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
  contactEmail: string;
  contactPhone: string;
  status: "submitted";
  createdAt: Date | null;
  matches: RequestProviderMatchRecord[];
};

export type RequestProviderMatchRecord = {
  id: number;
  providerProfileId: number;
  providerDisplayName: string | null;
  hourlyRateCents: number | null;
  status: "pending" | "proposed" | "accepted" | "declined" | "expired";
  matchSource: "weekly" | "on_demand";
  distanceMiles: number | null;
  proposedDate: string | null;
  proposedStartTime: string | null;
  proposedEndTime: string | null;
  providerResponseNote: string | null;
};

type ServiceRequestInput = {
  providerProfileId: number | null;
  matchPreference: "any" | "specific";
  serviceType: string;
  zipCode: string;
  requestedDate: string;
  windowStartTime: string;
  windowEndTime: string;
  durationMinutes: number;
  urgency: "urgent" | "soon" | "flexible";
  notes: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

type LocationInput = {
  latitude: number;
  longitude: number;
} | null;

type RequestMatchCandidate = {
  id: number;
  displayName: string | null;
  latitude: number | null;
  longitude: number | null;
  serviceRadiusMiles: number | null;
  hourlyRateCents: number | null;
  status: string;
  onDemandAvailable: boolean;
  minimumNoticeMinutes: number;
  services: Array<{ serviceType: string; label: string }>;
  availabilityWindows: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
};

type RequestProviderMatchInput = {
  providerProfileId: number;
  matchSource: "weekly" | "on_demand";
  distanceMiles: number;
};

function normalizeServices(services: unknown) {
  return (Array.isArray(services) ? services : [])
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
    }));
}

function normalizeAvailabilityWindows(windows: unknown) {
  return (Array.isArray(windows) ? windows : [])
    .filter((window): window is { dayOfWeek: number; startTime: string; endTime: string } => {
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
}

function toProviderTarget(row: Record<string, unknown>): RequestProviderTarget {
  return {
    id: Number(row.id),
    displayName: (row.displayName as string | null) ?? null,
    zipCode: (row.zipCode as string | null) ?? null,
    services: normalizeServices(row.services),
  };
}

function toRequestMatchCandidate(row: Record<string, unknown>): RequestMatchCandidate {
  return {
    id: Number(row.id),
    displayName: (row.displayName as string | null) ?? null,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    serviceRadiusMiles: row.serviceRadiusMiles === null ? null : Number(row.serviceRadiusMiles),
    hourlyRateCents: row.hourlyRateCents === null ? null : Number(row.hourlyRateCents),
    status: String(row.status),
    onDemandAvailable: Boolean(row.onDemandAvailable),
    minimumNoticeMinutes: row.minimumNoticeMinutes === null ? 120 : Number(row.minimumNoticeMinutes),
    services: normalizeServices(row.services),
    availabilityWindows: normalizeAvailabilityWindows(row.availabilityWindows),
  };
}

function toRequestProviderMatchRecord(row: Record<string, unknown>): RequestProviderMatchRecord {
  const status =
    row.status === "proposed" ||
    row.status === "accepted" ||
    row.status === "declined" ||
    row.status === "expired"
      ? row.status
      : "pending";
  const matchSource = row.matchSource === "on_demand" ? "on_demand" : "weekly";

  return {
    id: Number(row.id),
    providerProfileId: Number(row.providerProfileId),
    providerDisplayName: (row.providerDisplayName as string | null) ?? null,
    hourlyRateCents: row.hourlyRateCents === null ? null : Number(row.hourlyRateCents),
    status,
    matchSource,
    distanceMiles: row.distanceMiles === null ? null : Number(row.distanceMiles),
    proposedDate: (row.proposedDate as string | null) ?? null,
    proposedStartTime: (row.proposedStartTime as string | null) ?? null,
    proposedEndTime: (row.proposedEndTime as string | null) ?? null,
    providerResponseNote: (row.providerResponseNote as string | null) ?? null,
  };
}

function toServiceRequestRecord(
  row: Record<string, unknown>,
  matches: RequestProviderMatchRecord[] = [],
): ServiceRequestRecord {
  const matchPreference = row.matchPreference === "specific" ? "specific" : "any";
  const urgency = row.urgency === "urgent" || row.urgency === "flexible" ? row.urgency : "soon";

  return {
    id: Number(row.id),
    requesterUserId: String(row.requesterUserId),
    providerProfileId: row.providerProfileId === null ? null : Number(row.providerProfileId),
    providerDisplayName: (row.providerDisplayName as string | null) ?? null,
    matchPreference,
    serviceType: String(row.serviceType),
    serviceLabel: providerServiceLabels.get(String(row.serviceType)) ?? String(row.serviceType),
    zipCode: String(row.zipCode),
    requestedDate: String(row.requestedDate),
    windowStartTime: String(row.windowStartTime),
    windowEndTime: String(row.windowEndTime),
    durationMinutes: Number(row.durationMinutes),
    urgency,
    notes: (row.notes as string | null) ?? null,
    contactName: String(row.contactName),
    contactEmail: String(row.contactEmail),
    contactPhone: String(row.contactPhone),
    status: "submitted",
    createdAt: (row.createdAt as Date | null) ?? null,
    matches,
  };
}

async function getRequestMatchCandidates(input: ServiceRequestInput) {
  const sql = getSql();
  const targetProviderId = input.matchPreference === "specific" ? input.providerProfileId ?? 0 : 0;

  await ensureServiceRequestTables();
  const rows = await sql`
    SELECT
      p.id,
      p.display_name as "displayName",
      p.latitude,
      p.longitude,
      p.service_radius_miles as "serviceRadiusMiles",
      p.hourly_rate_cents as "hourlyRateCents",
      p.status,
      p.on_demand_available as "onDemandAvailable",
      p.minimum_notice_minutes as "minimumNoticeMinutes",
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
    WHERE p.status = 'active'
      AND (${targetProviderId} = 0 OR p.id = ${targetProviderId})
      AND EXISTS (
        SELECT 1
        FROM provider_services ps
        WHERE ps.provider_profile_id = p.id AND ps.service_type = ${input.serviceType}
      )
    ORDER BY p.updated_at DESC
  `;

  return (rows as Array<Record<string, unknown>>).map((row) => toRequestMatchCandidate(row));
}

export async function getActiveRequestProviderTarget(providerId: number) {
  const sql = getSql();

  await ensureServiceRequestTables();
  const rows = await sql`
    SELECT
      p.id,
      p.display_name as "displayName",
      p.zip_code as "zipCode",
      COALESCE(
        (
          SELECT json_agg(json_build_object('serviceType', ps.service_type) ORDER BY ps.service_type)
          FROM provider_services ps
          WHERE ps.provider_profile_id = p.id
        ),
        '[]'
      ) as services
    FROM provider_profiles p
    WHERE p.id = ${providerId} AND p.status = 'active'
  `;

  const records = rows as Array<Record<string, unknown>>;
  return records[0] ? toProviderTarget(records[0]) : null;
}

export async function createServiceRequest(
  requesterUserId: string,
  input: ServiceRequestInput,
  location: LocationInput,
) {
  const candidates = await getRequestMatchCandidates(input);
  const matches = findRequestProviderMatches(candidates, {
    serviceType: input.serviceType,
    location,
    requestedDate: input.requestedDate,
    windowStartTime: input.windowStartTime,
    windowEndTime: input.windowEndTime,
    durationMinutes: input.durationMinutes,
    targetProviderId: input.matchPreference === "specific" ? input.providerProfileId : null,
  }) as RequestProviderMatchInput[];
  const pool = getPool();
  const client = await pool.connect();
  let didBegin = false;

  await ensureServiceRequestTables();

  try {
    await client.query("BEGIN");
    didBegin = true;
    const result = await client.query(
      `
        INSERT INTO service_requests (
          requester_user_id,
          provider_profile_id,
          match_preference,
          service_type,
          zip_code,
          latitude,
          longitude,
          requested_date,
          window_start_time,
          window_end_time,
          duration_minutes,
          urgency,
          notes,
          contact_name,
          contact_email,
          contact_phone,
          status,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, 'submitted', now()
        )
        RETURNING id
      `,
      [
        requesterUserId,
        input.providerProfileId,
        input.matchPreference,
        input.serviceType,
        input.zipCode,
        location?.latitude ?? null,
        location?.longitude ?? null,
        input.requestedDate,
        input.windowStartTime,
        input.windowEndTime,
        input.durationMinutes,
        input.urgency,
        input.notes || null,
        input.contactName,
        input.contactEmail,
        input.contactPhone,
      ],
    );
    const requestId = Number(result.rows[0].id);

    for (const match of matches) {
      await client.query(
        `
          INSERT INTO request_provider_matches (
            service_request_id,
            provider_profile_id,
            status,
            match_source,
            distance_miles,
            updated_at
          )
          VALUES ($1, $2, 'pending', $3, $4, now())
          ON CONFLICT (service_request_id, provider_profile_id) DO NOTHING
        `,
        [requestId, match.providerProfileId, match.matchSource, match.distanceMiles],
      );
    }

    await client.query("COMMIT");
    didBegin = false;
    return requestId;
  } catch (error) {
    if (didBegin) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function getServiceRequestForRequester(requestId: number, requesterUserId: string) {
  const sql = getSql();

  await ensureServiceRequestTables();
  const rows = await sql`
    SELECT
      sr.id,
      sr.requester_user_id as "requesterUserId",
      sr.provider_profile_id as "providerProfileId",
      p.display_name as "providerDisplayName",
      sr.match_preference as "matchPreference",
      sr.service_type as "serviceType",
      sr.zip_code as "zipCode",
      to_char(sr.requested_date, 'YYYY-MM-DD') as "requestedDate",
      to_char(sr.window_start_time, 'HH24:MI') as "windowStartTime",
      to_char(sr.window_end_time, 'HH24:MI') as "windowEndTime",
      sr.duration_minutes as "durationMinutes",
      sr.urgency,
      sr.notes,
      sr.contact_name as "contactName",
      sr.contact_email as "contactEmail",
      sr.contact_phone as "contactPhone",
      sr.status,
      sr.created_at as "createdAt"
    FROM service_requests sr
    LEFT JOIN provider_profiles p ON p.id = sr.provider_profile_id
    WHERE sr.id = ${requestId} AND sr.requester_user_id = ${requesterUserId}
  `;

  const records = rows as Array<Record<string, unknown>>;
  if (!records[0]) return null;

  const matchRows = await sql`
    SELECT
      rpm.id,
      rpm.provider_profile_id as "providerProfileId",
      p.display_name as "providerDisplayName",
      p.hourly_rate_cents as "hourlyRateCents",
      rpm.status,
      rpm.match_source as "matchSource",
      rpm.distance_miles as "distanceMiles",
      to_char(rpm.proposed_date, 'YYYY-MM-DD') as "proposedDate",
      to_char(rpm.proposed_start_time, 'HH24:MI') as "proposedStartTime",
      to_char(rpm.proposed_end_time, 'HH24:MI') as "proposedEndTime",
      rpm.provider_response_note as "providerResponseNote"
    FROM request_provider_matches rpm
    JOIN service_requests sr ON sr.id = rpm.service_request_id
    JOIN provider_profiles p ON p.id = rpm.provider_profile_id
    WHERE rpm.service_request_id = ${requestId}
      AND sr.requester_user_id = ${requesterUserId}
    ORDER BY rpm.distance_miles ASC NULLS LAST, rpm.created_at ASC
  `;
  const matches = (matchRows as Array<Record<string, unknown>>).map((row) =>
    toRequestProviderMatchRecord(row),
  );

  return toServiceRequestRecord(records[0], matches);
}
