import { ensureMessagingTables, ensureServiceRequestTables, getPool, getSql } from "../lib/database";
import { getServicePaymentForRequester, type ServicePaymentRecord } from "../payments/db";
import { providerServiceLabels } from "../provider/services.js";
import { findRequestProviderMatches } from "./matching.js";

export type ServiceRequestStatus = "submitted" | "payment_pending" | "confirmed" | "completed" | "canceled";

export class UnavailableProviderMatchError extends Error {
  constructor() {
    super("Selected provider is unavailable for this request");
    this.name = "UnavailableProviderMatchError";
  }
}

export type RequestProviderTarget = {
  id: number;
  displayName: string | null;
  zipCode: string | null;
  services: Array<{ serviceType: string; label: string }>;
  availabilityTimezone: string;
  onDemandAvailable: boolean;
  minimumNoticeMinutes: number;
  availabilityWindows: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  bookings: Array<{
    bookingDate: string;
    startTime: string;
    endTime: string;
    status: "payment_pending" | "confirmed" | "completed" | "canceled";
  }>;
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
  status: ServiceRequestStatus;
  createdAt: Date | null;
  booking: ServiceBookingRecord | null;
  payment: ServicePaymentRecord | null;
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
  messageThreadId: number | null;
  messageUnreadCount: number;
};

export type ServiceBookingRecord = {
  id: number;
  providerProfileId: number;
  providerDisplayName: string | null;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: "payment_pending" | "confirmed" | "completed" | "canceled";
};

export type UpcomingVisitRecord = {
  id: number;
  serviceRequestId: number;
  serviceType: string;
  serviceLabel: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: "confirmed";
  role: "requester" | "provider";
  participantName: string;
  endsAt: string;
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
  bookings: Array<{
    bookingDate: string;
    startTime: string;
    endTime: string;
    status: "payment_pending" | "confirmed" | "completed" | "canceled";
  }>;
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

function normalizeBookings(bookings: unknown): RequestMatchCandidate["bookings"] {
  return (Array.isArray(bookings) ? bookings : [])
    .filter(
      (
        booking,
      ): booking is {
        bookingDate: string;
        startTime: string;
        endTime: string;
        status?: unknown;
      } => {
        return (
          typeof booking === "object" &&
          booking !== null &&
          typeof (booking as { bookingDate?: unknown }).bookingDate === "string" &&
          typeof (booking as { startTime?: unknown }).startTime === "string" &&
          typeof (booking as { endTime?: unknown }).endTime === "string"
        );
      },
    )
    .map((booking) => {
      const status: "payment_pending" | "confirmed" | "completed" | "canceled" =
        booking.status === "completed" || booking.status === "canceled" || booking.status === "payment_pending"
          ? booking.status
          : "confirmed";

      return {
        bookingDate: booking.bookingDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status,
      };
    });
}

function normalizeServiceRequestStatus(status: unknown): ServiceRequestStatus {
  if (
    status === "payment_pending" ||
    status === "confirmed" ||
    status === "completed" ||
    status === "canceled"
  ) {
    return status;
  }

  return "submitted";
}

function toProviderTarget(row: Record<string, unknown>): RequestProviderTarget {
  return {
    id: Number(row.id),
    displayName: (row.displayName as string | null) ?? null,
    zipCode: (row.zipCode as string | null) ?? null,
    services: normalizeServices(row.services),
    availabilityTimezone: (row.availabilityTimezone as string | null) ?? "America/Los_Angeles",
    onDemandAvailable: Boolean(row.onDemandAvailable),
    minimumNoticeMinutes: row.minimumNoticeMinutes === null ? 120 : Number(row.minimumNoticeMinutes),
    availabilityWindows: normalizeAvailabilityWindows(row.availabilityWindows),
    bookings: normalizeBookings(row.bookings),
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
    bookings: normalizeBookings(row.bookings),
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
    messageThreadId: row.messageThreadId === null ? null : Number(row.messageThreadId),
    messageUnreadCount: Number(row.messageUnreadCount ?? 0),
  };
}

function toServiceBookingRecord(row: Record<string, unknown>): ServiceBookingRecord {
  const status =
    row.status === "payment_pending" || row.status === "completed" || row.status === "canceled"
      ? row.status
      : "confirmed";

  return {
    id: Number(row.id),
    providerProfileId: Number(row.providerProfileId),
    providerDisplayName: (row.providerDisplayName as string | null) ?? null,
    bookingDate: String(row.bookingDate),
    startTime: String(row.startTime),
    endTime: String(row.endTime),
    status,
  };
}

function toIsoString(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();

  return new Date().toISOString();
}

function toUpcomingVisitRecord(row: Record<string, unknown>, userId: string): UpcomingVisitRecord {
  const requesterUserId = String(row.requesterUserId);
  const providerName = String(row.providerDisplayName || row.providerAccountName || "Provider");
  const requesterName = String(row.requesterContactName || row.requesterAccountName || "Requester");
  const role = requesterUserId === userId ? "requester" : "provider";

  return {
    id: Number(row.id),
    serviceRequestId: Number(row.serviceRequestId),
    serviceType: String(row.serviceType),
    serviceLabel: providerServiceLabels.get(String(row.serviceType)) ?? String(row.serviceType),
    bookingDate: String(row.bookingDate),
    startTime: String(row.startTime),
    endTime: String(row.endTime),
    status: "confirmed",
    role,
    participantName: role === "requester" ? providerName : requesterName,
    endsAt: toIsoString(row.endsAt),
  };
}

function toServiceRequestRecord(
  row: Record<string, unknown>,
  matches: RequestProviderMatchRecord[] = [],
  booking: ServiceBookingRecord | null = null,
  payment: ServicePaymentRecord | null = null,
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
    status: normalizeServiceRequestStatus(row.status),
    createdAt: (row.createdAt as Date | null) ?? null,
    booking,
    payment,
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
      ) as "availabilityWindows",
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'bookingDate', to_char(sb.booking_date, 'YYYY-MM-DD'),
              'startTime', to_char(sb.start_time, 'HH24:MI'),
              'endTime', to_char(sb.end_time, 'HH24:MI'),
              'status', sb.status
            )
            ORDER BY sb.booking_date, sb.start_time
          )
          FROM service_bookings sb
          WHERE sb.provider_profile_id = p.id AND sb.status in ('payment_pending', 'confirmed')
        ),
        '[]'
      ) as bookings
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
      p.availability_timezone as "availabilityTimezone",
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
      ) as "availabilityWindows",
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'bookingDate', to_char(sb.booking_date, 'YYYY-MM-DD'),
              'startTime', to_char(sb.start_time, 'HH24:MI'),
              'endTime', to_char(sb.end_time, 'HH24:MI'),
              'status', sb.status
            )
            ORDER BY sb.booking_date, sb.start_time
          )
          FROM service_bookings sb
          WHERE sb.provider_profile_id = p.id AND sb.status in ('payment_pending', 'confirmed')
        ),
        '[]'
      ) as bookings
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
  if (input.matchPreference === "specific" && matches.length === 0) {
    throw new UnavailableProviderMatchError();
  }

  const pool = getPool();
  const client = await pool.connect();
  let didBegin = false;

  await ensureMessagingTables();

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
      const matchResult = await client.query(
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
          RETURNING id
        `,
        [requestId, match.providerProfileId, match.matchSource, match.distanceMiles],
      );
      const matchId = matchResult.rows[0] ? Number(matchResult.rows[0].id) : null;

      if (matchId) {
        await client.query(
          `
            INSERT INTO message_threads (
              service_request_id,
              request_provider_match_id,
              requester_user_id,
              provider_user_id,
              updated_at
            )
            SELECT
              sr.id,
              $2,
              sr.requester_user_id,
              p.user_id,
              now()
            FROM service_requests sr
            JOIN provider_profiles p ON p.id = $3
            WHERE sr.id = $1
            ON CONFLICT (request_provider_match_id) DO NOTHING
          `,
          [requestId, matchId, match.providerProfileId],
        );
      }
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

async function getRequestMatchesForRequester(
  requestId: number,
  requesterUserId: string,
  sql: ReturnType<typeof getSql> = getSql(),
) {
  await ensureMessagingTables();
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
      rpm.provider_response_note as "providerResponseNote",
      mt.id as "messageThreadId",
      COALESCE(
        (
          SELECT count(*)::int
          FROM messages m
          WHERE m.message_thread_id = mt.id
            AND m.sender_user_id <> ${requesterUserId}
            AND m.created_at > COALESCE(mt.requester_read_at, '-infinity'::timestamptz)
        ),
        0
      ) as "messageUnreadCount"
    FROM request_provider_matches rpm
    JOIN service_requests sr ON sr.id = rpm.service_request_id
    JOIN provider_profiles p ON p.id = rpm.provider_profile_id
    LEFT JOIN message_threads mt ON mt.request_provider_match_id = rpm.id
    WHERE rpm.service_request_id = ${requestId}
      AND sr.requester_user_id = ${requesterUserId}
    ORDER BY
      CASE rpm.status
        WHEN 'accepted' THEN 0
        WHEN 'proposed' THEN 1
        WHEN 'pending' THEN 2
        ELSE 3
      END,
      rpm.distance_miles ASC NULLS LAST,
      rpm.created_at ASC
  `;

  return (matchRows as Array<Record<string, unknown>>).map((row) =>
    toRequestProviderMatchRecord(row),
  );
}

async function getRequestBookingForRequester(
  requestId: number,
  requesterUserId: string,
  sql: ReturnType<typeof getSql> = getSql(),
) {
  const rows = await sql`
    SELECT
      sb.id,
      sb.provider_profile_id as "providerProfileId",
      p.display_name as "providerDisplayName",
      to_char(sb.booking_date, 'YYYY-MM-DD') as "bookingDate",
      to_char(sb.start_time, 'HH24:MI') as "startTime",
      to_char(sb.end_time, 'HH24:MI') as "endTime",
      sb.status
    FROM service_bookings sb
    JOIN service_requests sr ON sr.id = sb.service_request_id
    JOIN provider_profiles p ON p.id = sb.provider_profile_id
    WHERE sb.service_request_id = ${requestId}
      AND sr.requester_user_id = ${requesterUserId}
    ORDER BY sb.created_at DESC
    LIMIT 1
  `;
  const records = rows as Array<Record<string, unknown>>;

  return records[0] ? toServiceBookingRecord(records[0]) : null;
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

  const [matches, booking, payment] = await Promise.all([
    getRequestMatchesForRequester(requestId, requesterUserId, sql),
    getRequestBookingForRequester(requestId, requesterUserId, sql),
    getServicePaymentForRequester(requestId, requesterUserId, sql),
  ]);

  return toServiceRequestRecord(records[0], matches, booking, payment);
}

export async function getServiceRequestsForRequester(requesterUserId: string) {
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
    WHERE sr.requester_user_id = ${requesterUserId}
    ORDER BY sr.created_at DESC
  `;
  const records = rows as Array<Record<string, unknown>>;

  return Promise.all(
    records.map(async (record) => {
      const requestId = Number(record.id);
      const [matches, booking, payment] = await Promise.all([
        getRequestMatchesForRequester(requestId, requesterUserId, sql),
        getRequestBookingForRequester(requestId, requesterUserId, sql),
        getServicePaymentForRequester(requestId, requesterUserId, sql),
      ]);

      return toServiceRequestRecord(record, matches, booking, payment);
    }),
  );
}

export async function getNextUpcomingVisitForUser(userId: string) {
  const sql = getSql();

  await ensureServiceRequestTables();
  const rows = await sql`
    SELECT
      sb.id,
      sb.service_request_id as "serviceRequestId",
      sr.requester_user_id as "requesterUserId",
      p.user_id as "providerUserId",
      sr.service_type as "serviceType",
      sr.contact_name as "requesterContactName",
      requester.name as "requesterAccountName",
      p.display_name as "providerDisplayName",
      provider_user.name as "providerAccountName",
      to_char(sb.booking_date, 'YYYY-MM-DD') as "bookingDate",
      to_char(sb.start_time, 'HH24:MI') as "startTime",
      to_char(sb.end_time, 'HH24:MI') as "endTime",
      sb.status,
      ((sb.booking_date + sb.end_time) AT TIME ZONE 'America/Los_Angeles') as "endsAt"
    FROM service_bookings sb
    JOIN service_requests sr ON sr.id = sb.service_request_id
    JOIN provider_profiles p ON p.id = sb.provider_profile_id
    LEFT JOIN users requester ON requester.id = sr.requester_user_id
    LEFT JOIN users provider_user ON provider_user.id = p.user_id
    WHERE sb.status = 'confirmed'
      AND (sr.requester_user_id = ${userId} OR p.user_id = ${userId})
      AND (sb.booking_date + sb.end_time) > (now() AT TIME ZONE 'America/Los_Angeles')
    ORDER BY sb.booking_date ASC, sb.start_time ASC, sb.id ASC
    LIMIT 1
  `;
  const records = rows as Array<Record<string, unknown>>;

  return records[0] ? toUpcomingVisitRecord(records[0], userId) : null;
}

export async function cancelServiceRequestForRequester(
  requestId: number,
  requesterUserId: string,
  cancellationReason = "Canceled by requester",
) {
  const pool = getPool();
  const client = await pool.connect();
  let didBegin = false;

  await ensureServiceRequestTables();

  try {
    await client.query("BEGIN");
    didBegin = true;
    const affectedMatchesResult = await client.query(
      `
        SELECT rpm.id
        FROM request_provider_matches rpm
        JOIN service_requests sr ON sr.id = rpm.service_request_id
        WHERE sr.id = $1
          AND sr.requester_user_id = $2
          AND sr.status not in ('completed', 'canceled')
          AND rpm.status in ('pending', 'proposed', 'accepted')
        FOR UPDATE OF rpm
      `,
      [requestId, requesterUserId],
    );
    const affectedMatchIds = affectedMatchesResult.rows.map((row) => Number(row.id));
    const result = await client.query(
      `
        UPDATE service_requests
        SET status = 'canceled', updated_at = now()
        WHERE id = $1
          AND requester_user_id = $2
          AND status not in ('completed', 'canceled')
        RETURNING id
      `,
      [requestId, requesterUserId],
    );

    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      didBegin = false;
      return { updated: false, affectedMatchIds: [] as number[] };
    }

    await client.query(
      `
        UPDATE service_bookings
        SET
          status = 'canceled',
          canceled_at = now(),
          canceled_by_user_id = $2,
          cancellation_reason = $3,
          updated_at = now()
        WHERE service_request_id = $1
          AND status <> 'canceled'
      `,
      [requestId, requesterUserId, cancellationReason],
    );

    await client.query(
      `
        UPDATE service_payments
        SET
          status = 'canceled',
          canceled_at = now(),
          updated_at = now()
        WHERE service_request_id = $1
          AND status <> 'paid'
      `,
      [requestId],
    );

    await client.query(
      `
        UPDATE request_provider_matches
        SET
          status = 'expired',
          responded_at = COALESCE(responded_at, now()),
          updated_at = now()
        WHERE service_request_id = $1
          AND status in ('pending', 'proposed')
      `,
      [requestId],
    );

    await client.query("COMMIT");
    didBegin = false;
    return { updated: true, affectedMatchIds };
  } catch (error) {
    if (didBegin) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }
}
