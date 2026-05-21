import { ensureServiceRequestTables, getSql } from "../lib/database";
import { providerServiceLabels } from "../provider/services.js";

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

function toProviderTarget(row: Record<string, unknown>): RequestProviderTarget {
  return {
    id: Number(row.id),
    displayName: (row.displayName as string | null) ?? null,
    zipCode: (row.zipCode as string | null) ?? null,
    services: normalizeServices(row.services),
  };
}

function toServiceRequestRecord(row: Record<string, unknown>): ServiceRequestRecord {
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
  };
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
  const sql = getSql();

  await ensureServiceRequestTables();
  const rows = await sql`
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
      ${requesterUserId},
      ${input.providerProfileId},
      ${input.matchPreference},
      ${input.serviceType},
      ${input.zipCode},
      ${location?.latitude ?? null},
      ${location?.longitude ?? null},
      ${input.requestedDate},
      ${input.windowStartTime},
      ${input.windowEndTime},
      ${input.durationMinutes},
      ${input.urgency},
      ${input.notes || null},
      ${input.contactName},
      ${input.contactEmail},
      ${input.contactPhone},
      'submitted',
      now()
    )
    RETURNING id
  `;

  const records = rows as Array<Record<string, unknown>>;
  return Number(records[0].id);
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
  return records[0] ? toServiceRequestRecord(records[0]) : null;
}
