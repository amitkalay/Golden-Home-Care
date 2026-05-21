import { Resend } from "resend";
import { ensureNotificationTables, getPool, getSql } from "../lib/database";
import { providerServiceLabels } from "../provider/services.js";

export type NotificationEmailStatus = "not_applicable" | "pending" | "sent" | "failed" | "skipped";

export type NotificationRecord = {
  id: number;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: Date | null;
  emailStatus: NotificationEmailStatus;
  emailTo: string | null;
  emailSubject: string | null;
  createdAt: Date | null;
};

type NotificationInput = {
  recipientUserId: string;
  type: string;
  title: string;
  body: string;
  href?: string | null;
  serviceRequestId?: number | null;
  requestProviderMatchId?: number | null;
  serviceBookingId?: number | null;
  dedupeKey: string;
  sendEmail?: boolean;
  emailSubject?: string;
  emailBody?: string;
};

type NotificationEmailPayload = {
  id: number;
  to: string | null;
  subject: string;
  title: string;
  body: string;
  href: string | null;
  dedupeKey: string;
};

function normalizeEmailStatus(status: unknown): NotificationEmailStatus {
  if (
    status === "pending" ||
    status === "sent" ||
    status === "failed" ||
    status === "skipped"
  ) {
    return status;
  }

  return "not_applicable";
}

function toNotificationRecord(row: Record<string, unknown>): NotificationRecord {
  return {
    id: Number(row.id),
    type: String(row.type),
    title: String(row.title),
    body: String(row.body),
    href: (row.href as string | null) ?? null,
    readAt: (row.readAt as Date | null) ?? null,
    emailStatus: normalizeEmailStatus(row.emailStatus),
    emailTo: (row.emailTo as string | null) ?? null,
    emailSubject: (row.emailSubject as string | null) ?? null,
    createdAt: (row.createdAt as Date | null) ?? null,
  };
}

function formatService(serviceType: string) {
  return providerServiceLabels.get(serviceType) ?? serviceType;
}

function formatTime(value: string) {
  const [hourInput, minute] = value.split(":");
  const hour = Number.parseInt(hourInput, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
}

function formatRequestWindow(row: Record<string, unknown>) {
  return `${row.requestedDate} from ${formatTime(String(row.windowStartTime))} to ${formatTime(
    String(row.windowEndTime),
  )}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getAppBaseUrl() {
  const configuredUrl =
    process.env.APP_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  return configuredUrl.replace(/\/$/, "");
}

function getAbsoluteHref(href: string | null) {
  if (!href) return null;
  if (/^https?:\/\//.test(href)) return href;

  const baseUrl = getAppBaseUrl();
  return baseUrl ? `${baseUrl}${href.startsWith("/") ? href : `/${href}`}` : null;
}

function buildEmailHtml(payload: NotificationEmailPayload) {
  const absoluteHref = getAbsoluteHref(payload.href);
  const link = absoluteHref
    ? `<p><a href="${escapeHtml(absoluteHref)}" style="color:#1f5744;font-weight:700;">View details</a></p>`
    : "";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#25332f;">
      <h1 style="font-size:22px;color:#1f5744;">${escapeHtml(payload.title)}</h1>
      <p>${escapeHtml(payload.body)}</p>
      ${link}
      <p style="color:#5f665f;font-size:13px;">Golden Home Care</p>
    </div>
  `;
}

async function updateNotificationEmailStatus(
  notificationId: number,
  status: NotificationEmailStatus,
  error?: string,
) {
  const sql = getSql();

  await sql`
    UPDATE notifications
    SET
      email_status = ${status},
      email_error = ${error ?? null},
      email_sent_at = CASE WHEN ${status} = 'sent' THEN now() ELSE email_sent_at END,
      updated_at = now()
    WHERE id = ${notificationId}
  `;
}

async function sendNotificationEmail(payload: NotificationEmailPayload) {
  if (!payload.to || !process.env.RESEND_API_KEY || !process.env.NOTIFICATIONS_FROM_EMAIL) {
    await updateNotificationEmailStatus(payload.id, "skipped");
    return;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send(
      {
        from: process.env.NOTIFICATIONS_FROM_EMAIL,
        to: payload.to,
        subject: payload.subject,
        html: buildEmailHtml(payload),
        text: `${payload.title}\n\n${payload.body}`,
      },
      { idempotencyKey: payload.dedupeKey },
    );

    if (error) {
      throw new Error(error.message || "Resend email failed");
    }

    await updateNotificationEmailStatus(payload.id, "sent");
  } catch (error) {
    console.error("Failed to send notification email", error);
    await updateNotificationEmailStatus(
      payload.id,
      "failed",
      error instanceof Error ? error.message : "Unknown email error",
    );
  }
}

async function createNotification(input: NotificationInput) {
  const sql = getSql();
  const emailStatus: NotificationEmailStatus = input.sendEmail ? "pending" : "not_applicable";
  const emailSubject = input.emailSubject ?? input.title;

  await ensureNotificationTables();
  const rows = await sql`
    INSERT INTO notifications (
      recipient_user_id,
      type,
      title,
      body,
      href,
      service_request_id,
      request_provider_match_id,
      service_booking_id,
      dedupe_key,
      email_status,
      email_to,
      email_subject,
      updated_at
    )
    SELECT
      u.id,
      ${input.type},
      ${input.title},
      ${input.body},
      ${input.href ?? null},
      ${input.serviceRequestId ?? null},
      ${input.requestProviderMatchId ?? null},
      ${input.serviceBookingId ?? null},
      ${input.dedupeKey},
      ${emailStatus},
      CASE WHEN ${input.sendEmail ? true : false} THEN u.email ELSE NULL END,
      CASE WHEN ${input.sendEmail ? true : false} THEN ${emailSubject} ELSE NULL END,
      now()
    FROM users u
    WHERE u.id = ${input.recipientUserId}
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING id, email_to as "emailTo"
  `;
  const created = (rows as Array<Record<string, unknown>>)[0];

  if (created && input.sendEmail) {
    await sendNotificationEmail({
      id: Number(created.id),
      to: (created.emailTo as string | null) ?? null,
      subject: emailSubject,
      title: input.title,
      body: input.emailBody ?? input.body,
      href: input.href ?? null,
      dedupeKey: input.dedupeKey,
    });
  }

  return created ? Number(created.id) : null;
}

export async function getUnreadNotificationCount(userId: string) {
  const sql = getSql();

  await ensureNotificationTables();
  const rows = await sql`
    SELECT count(*)::int as count
    FROM notifications
    WHERE recipient_user_id = ${userId}
      AND read_at IS NULL
  `;
  const records = rows as Array<Record<string, unknown>>;

  return records[0] ? Number(records[0].count) : 0;
}

export async function getNotificationCount(userId: string) {
  const sql = getSql();

  await ensureNotificationTables();
  const rows = await sql`
    SELECT count(*)::int as count
    FROM notifications
    WHERE recipient_user_id = ${userId}
  `;
  const records = rows as Array<Record<string, unknown>>;

  return records[0] ? Number(records[0].count) : 0;
}

export async function getUserNotifications(userId: string, filter: "all" | "unread" = "unread") {
  const sql = getSql();

  await ensureNotificationTables();
  const rows = await sql`
    SELECT
      id,
      type,
      title,
      body,
      href,
      read_at as "readAt",
      email_status as "emailStatus",
      email_to as "emailTo",
      email_subject as "emailSubject",
      created_at as "createdAt"
    FROM notifications
    WHERE recipient_user_id = ${userId}
      AND (${filter} = 'all' OR read_at IS NULL)
    ORDER BY created_at DESC
  `;

  return (rows as Array<Record<string, unknown>>).map((row) => toNotificationRecord(row));
}

export async function markNotificationReadForUser(userId: string, notificationId: number) {
  const sql = getSql();

  await ensureNotificationTables();
  const rows = await sql`
    UPDATE notifications
    SET read_at = COALESCE(read_at, now()), updated_at = now()
    WHERE id = ${notificationId}
      AND recipient_user_id = ${userId}
    RETURNING id
  `;

  return (rows as Array<Record<string, unknown>>).length > 0;
}

export async function markAllNotificationsReadForUser(userId: string) {
  const sql = getSql();

  await ensureNotificationTables();
  await sql`
    UPDATE notifications
    SET read_at = COALESCE(read_at, now()), updated_at = now()
    WHERE recipient_user_id = ${userId}
      AND read_at IS NULL
  `;
}

export async function notifyProvidersOfNewRequest(serviceRequestId: number) {
  const sql = getSql();

  await ensureNotificationTables();
  const rows = await sql`
    SELECT
      rpm.id as "matchId",
      p.user_id as "recipientUserId",
      sr.id as "requestId",
      sr.service_type as "serviceType",
      sr.zip_code as "zipCode",
      to_char(sr.requested_date, 'YYYY-MM-DD') as "requestedDate",
      to_char(sr.window_start_time, 'HH24:MI') as "windowStartTime",
      to_char(sr.window_end_time, 'HH24:MI') as "windowEndTime",
      rpm.match_source as "matchSource"
    FROM request_provider_matches rpm
    JOIN provider_profiles p ON p.id = rpm.provider_profile_id
    JOIN service_requests sr ON sr.id = rpm.service_request_id
    WHERE sr.id = ${serviceRequestId}
      AND rpm.status = 'pending'
    ORDER BY rpm.distance_miles ASC NULLS LAST, rpm.created_at ASC
  `;

  await Promise.all(
    (rows as Array<Record<string, unknown>>).map((row) => {
      const serviceLabel = formatService(String(row.serviceType));
      const matchSource = row.matchSource === "on_demand" ? "on-demand" : "weekly";
      const title = `New ${serviceLabel} request`;
      const body = `${serviceLabel} request in ZIP ${row.zipCode} for ${formatRequestWindow(row)}. Matched by ${matchSource} availability.`;

      return createNotification({
        recipientUserId: String(row.recipientUserId),
        type: "provider_new_request",
        title,
        body,
        href: "/provider/messages",
        serviceRequestId: Number(row.requestId),
        requestProviderMatchId: Number(row.matchId),
        dedupeKey: `request:${row.requestId}:match:${row.matchId}:provider:new`,
        sendEmail: true,
        emailSubject: title,
      });
    }),
  );
}

export async function notifyAfterProviderAccepted(matchId: number) {
  const sql = getSql();

  await ensureNotificationTables();
  const rows = await sql`
    SELECT
      rpm.id as "matchId",
      sr.id as "requestId",
      sr.requester_user_id as "recipientUserId",
      sr.service_type as "serviceType",
      to_char(sr.requested_date, 'YYYY-MM-DD') as "requestedDate",
      to_char(sr.window_start_time, 'HH24:MI') as "windowStartTime",
      to_char(sr.window_end_time, 'HH24:MI') as "windowEndTime",
      p.display_name as "providerDisplayName",
      sb.id as "bookingId"
    FROM request_provider_matches rpm
    JOIN service_requests sr ON sr.id = rpm.service_request_id
    JOIN provider_profiles p ON p.id = rpm.provider_profile_id
    LEFT JOIN service_bookings sb ON sb.request_provider_match_id = rpm.id
    WHERE rpm.id = ${matchId}
      AND rpm.status = 'accepted'
    LIMIT 1
  `;
  const accepted = (rows as Array<Record<string, unknown>>)[0];

  if (!accepted) return;

  const serviceLabel = formatService(String(accepted.serviceType));
  const providerName = String(accepted.providerDisplayName || "A provider");
  await createNotification({
    recipientUserId: String(accepted.recipientUserId),
    type: "requester_request_accepted",
    title: `${serviceLabel} request accepted`,
    body: `${providerName} accepted your ${serviceLabel} request for ${formatRequestWindow(accepted)}.`,
    href: `/requests/${accepted.requestId}`,
    serviceRequestId: Number(accepted.requestId),
    requestProviderMatchId: Number(accepted.matchId),
    serviceBookingId: accepted.bookingId === null ? null : Number(accepted.bookingId),
    dedupeKey: `request:${accepted.requestId}:match:${accepted.matchId}:requester:accepted`,
    sendEmail: true,
  });

  await notifyExpiredCompetingProviders(Number(accepted.requestId), Number(accepted.matchId));
}

async function notifyExpiredCompetingProviders(serviceRequestId: number, acceptedMatchId: number) {
  const sql = getSql();
  const rows = await sql`
    SELECT
      rpm.id as "matchId",
      p.user_id as "recipientUserId",
      sr.id as "requestId",
      sr.service_type as "serviceType",
      to_char(sr.requested_date, 'YYYY-MM-DD') as "requestedDate",
      to_char(sr.window_start_time, 'HH24:MI') as "windowStartTime",
      to_char(sr.window_end_time, 'HH24:MI') as "windowEndTime"
    FROM request_provider_matches rpm
    JOIN provider_profiles p ON p.id = rpm.provider_profile_id
    JOIN service_requests sr ON sr.id = rpm.service_request_id
    WHERE sr.id = ${serviceRequestId}
      AND rpm.id <> ${acceptedMatchId}
      AND rpm.status = 'expired'
  `;

  await Promise.all(
    (rows as Array<Record<string, unknown>>).map((row) => {
      const serviceLabel = formatService(String(row.serviceType));

      return createNotification({
        recipientUserId: String(row.recipientUserId),
        type: "provider_match_expired",
        title: `${serviceLabel} request closed`,
        body: `Another provider accepted the ${serviceLabel} request for ${formatRequestWindow(row)}.`,
        href: "/provider/messages?tab=closed",
        serviceRequestId: Number(row.requestId),
        requestProviderMatchId: Number(row.matchId),
        dedupeKey: `request:${row.requestId}:match:${row.matchId}:provider:expired`,
        sendEmail: false,
      });
    }),
  );
}

export async function notifyRequesterOfProviderDecline(matchId: number) {
  const sql = getSql();

  await ensureNotificationTables();
  const rows = await sql`
    SELECT
      rpm.id as "matchId",
      sr.id as "requestId",
      sr.requester_user_id as "recipientUserId",
      sr.service_type as "serviceType",
      p.display_name as "providerDisplayName"
    FROM request_provider_matches rpm
    JOIN service_requests sr ON sr.id = rpm.service_request_id
    JOIN provider_profiles p ON p.id = rpm.provider_profile_id
    WHERE rpm.id = ${matchId}
      AND rpm.status = 'declined'
    LIMIT 1
  `;
  const declined = (rows as Array<Record<string, unknown>>)[0];

  if (!declined) return;

  const serviceLabel = formatService(String(declined.serviceType));
  const providerName = String(declined.providerDisplayName || "A provider");
  await createNotification({
    recipientUserId: String(declined.recipientUserId),
    type: "requester_request_declined",
    title: `${serviceLabel} request declined`,
    body: `${providerName} declined your ${serviceLabel} request.`,
    href: `/requests/${declined.requestId}`,
    serviceRequestId: Number(declined.requestId),
    requestProviderMatchId: Number(declined.matchId),
    dedupeKey: `request:${declined.requestId}:match:${declined.matchId}:requester:declined`,
    sendEmail: true,
  });
}

export async function notifyRequesterOfProviderProposal(matchId: number) {
  const sql = getSql();

  await ensureNotificationTables();
  const rows = await sql`
    SELECT
      rpm.id as "matchId",
      sr.id as "requestId",
      sr.requester_user_id as "recipientUserId",
      sr.service_type as "serviceType",
      p.display_name as "providerDisplayName",
      to_char(rpm.proposed_date, 'YYYY-MM-DD') as "proposedDate",
      to_char(rpm.proposed_start_time, 'HH24:MI') as "proposedStartTime",
      to_char(rpm.proposed_end_time, 'HH24:MI') as "proposedEndTime"
    FROM request_provider_matches rpm
    JOIN service_requests sr ON sr.id = rpm.service_request_id
    JOIN provider_profiles p ON p.id = rpm.provider_profile_id
    WHERE rpm.id = ${matchId}
      AND rpm.status = 'proposed'
    LIMIT 1
  `;
  const proposed = (rows as Array<Record<string, unknown>>)[0];

  if (!proposed) return;

  const serviceLabel = formatService(String(proposed.serviceType));
  const providerName = String(proposed.providerDisplayName || "A provider");
  await createNotification({
    recipientUserId: String(proposed.recipientUserId),
    type: "requester_request_proposed",
    title: `${serviceLabel} alternate time proposed`,
    body: `${providerName} proposed ${proposed.proposedDate} from ${formatTime(
      String(proposed.proposedStartTime),
    )} to ${formatTime(String(proposed.proposedEndTime))}.`,
    href: `/requests/${proposed.requestId}`,
    serviceRequestId: Number(proposed.requestId),
    requestProviderMatchId: Number(proposed.matchId),
    dedupeKey: `request:${proposed.requestId}:match:${proposed.matchId}:requester:proposed`,
    sendEmail: true,
  });
}

export async function notifyProvidersOfRequesterCancellation(matchIds: number[]) {
  if (!matchIds.length) return;

  await ensureNotificationTables();
  const result = await getPool().query(
    `
      SELECT
        rpm.id as "matchId",
        p.user_id as "recipientUserId",
        sr.id as "requestId",
        sr.service_type as "serviceType",
        to_char(sr.requested_date, 'YYYY-MM-DD') as "requestedDate",
        to_char(sr.window_start_time, 'HH24:MI') as "windowStartTime",
        to_char(sr.window_end_time, 'HH24:MI') as "windowEndTime"
      FROM request_provider_matches rpm
      JOIN provider_profiles p ON p.id = rpm.provider_profile_id
      JOIN service_requests sr ON sr.id = rpm.service_request_id
      WHERE rpm.id = ANY($1::bigint[])
    `,
    [matchIds],
  );

  await Promise.all(
    (result.rows as Array<Record<string, unknown>>).map((row) => {
      const serviceLabel = formatService(String(row.serviceType));

      return createNotification({
        recipientUserId: String(row.recipientUserId),
        type: "provider_request_canceled",
        title: `${serviceLabel} request canceled`,
        body: `The requester canceled the ${serviceLabel} request for ${formatRequestWindow(row)}.`,
        href: "/provider/messages",
        serviceRequestId: Number(row.requestId),
        requestProviderMatchId: Number(row.matchId),
        dedupeKey: `request:${row.requestId}:match:${row.matchId}:provider:canceled`,
        sendEmail: true,
      });
    }),
  );
}
