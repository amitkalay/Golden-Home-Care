import { ensureMessagingTables, getPool, getSql } from "../lib/database";
import { providerServiceLabels } from "../provider/services.js";

export type MessageThreadRole = "requester" | "provider";
export type MessageRequestStatus = "submitted" | "payment_pending" | "confirmed" | "completed" | "canceled";
export type MessageMatchStatus = "pending" | "proposed" | "accepted" | "declined" | "expired";
export type MessageMatchSource = "weekly" | "on_demand";
export type MessageBookingStatus = "payment_pending" | "confirmed" | "completed" | "canceled";

export type MessageThreadRecord = {
  id: number;
  serviceRequestId: number;
  requestProviderMatchId: number;
  requesterUserId: string;
  providerUserId: string;
  role: MessageThreadRole;
  otherParticipantName: string;
  requestStatus: MessageRequestStatus;
  matchStatus: MessageMatchStatus;
  serviceType: string;
  serviceLabel: string;
  zipCode: string;
  requestedDate: string;
  windowStartTime: string;
  windowEndTime: string;
  durationMinutes: number;
  urgency: "urgent" | "soon" | "flexible";
  matchSource: MessageMatchSource;
  proposedDate: string | null;
  proposedStartTime: string | null;
  proposedEndTime: string | null;
  bookingDate: string | null;
  bookingStartTime: string | null;
  bookingEndTime: string | null;
  bookingStatus: MessageBookingStatus | null;
  scheduledEndAt: string | null;
  canSend: boolean;
  unreadCount: number;
  requesterReadAt: string | null;
  providerReadAt: string | null;
  updatedAt: string;
};

export type MessageRecord = {
  id: number;
  threadId: number;
  senderUserId: string;
  body: string;
  createdAt: string;
};

export type MessageThreadBundle = {
  thread: MessageThreadRecord;
  messages: MessageRecord[];
};

export type MessageInboxThreadBundle = MessageThreadBundle & {
  latestMessage: MessageRecord | null;
};

export type MessageSendResult = {
  message: MessageRecord;
  thread: MessageThreadRecord;
  recipientUserId: string;
  senderName: string;
};

function toIsoString(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();

  return new Date().toISOString();
}

function toNullableIsoString(value: unknown) {
  return value ? toIsoString(value) : null;
}

function normalizeRequestStatus(status: unknown): MessageThreadRecord["requestStatus"] {
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

function normalizeMatchStatus(status: unknown): MessageThreadRecord["matchStatus"] {
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

function normalizeMatchSource(source: unknown): MessageMatchSource {
  return source === "on_demand" ? "on_demand" : "weekly";
}

function normalizeUrgency(urgency: unknown): MessageThreadRecord["urgency"] {
  if (urgency === "urgent" || urgency === "flexible") {
    return urgency;
  }

  return "soon";
}

function normalizeBookingStatus(status: unknown): MessageBookingStatus | null {
  if (
    status === "payment_pending" ||
    status === "confirmed" ||
    status === "completed" ||
    status === "canceled"
  ) {
    return status;
  }

  return null;
}

function canSendToThread(
  requestStatus: MessageThreadRecord["requestStatus"],
  matchStatus: MessageThreadRecord["matchStatus"],
) {
  return (
    requestStatus !== "completed" &&
    requestStatus !== "canceled" &&
    (matchStatus === "pending" || matchStatus === "proposed" || matchStatus === "accepted")
  );
}

function toMessageRecord(row: Record<string, unknown>): MessageRecord {
  return {
    id: Number(row.id),
    threadId: Number(row.threadId),
    senderUserId: String(row.senderUserId),
    body: String(row.body),
    createdAt: toIsoString(row.createdAt),
  };
}

function toMessageThreadRecord(row: Record<string, unknown>, userId: string): MessageThreadRecord {
  const requesterUserId = String(row.requesterUserId);
  const providerUserId = String(row.providerUserId);
  const role: MessageThreadRole = userId === requesterUserId ? "requester" : "provider";
  const requestStatus = normalizeRequestStatus(row.requestStatus);
  const matchStatus = normalizeMatchStatus(row.matchStatus);
  const providerName = String(row.providerDisplayName || row.providerAccountName || "Provider");
  const requesterName = String(row.requesterContactName || row.requesterAccountName || "Requester");
  const serviceType = String(row.serviceType || "");

  return {
    id: Number(row.id),
    serviceRequestId: Number(row.serviceRequestId),
    requestProviderMatchId: Number(row.requestProviderMatchId),
    requesterUserId,
    providerUserId,
    role,
    otherParticipantName: role === "requester" ? providerName : requesterName,
    requestStatus,
    matchStatus,
    serviceType,
    serviceLabel: providerServiceLabels.get(serviceType) ?? serviceType,
    zipCode: String(row.zipCode || ""),
    requestedDate: String(row.requestedDate || ""),
    windowStartTime: String(row.windowStartTime || ""),
    windowEndTime: String(row.windowEndTime || ""),
    durationMinutes: Number(row.durationMinutes ?? 0),
    urgency: normalizeUrgency(row.urgency),
    matchSource: normalizeMatchSource(row.matchSource),
    proposedDate: (row.proposedDate as string | null) ?? null,
    proposedStartTime: (row.proposedStartTime as string | null) ?? null,
    proposedEndTime: (row.proposedEndTime as string | null) ?? null,
    bookingDate: (row.bookingDate as string | null) ?? null,
    bookingStartTime: (row.bookingStartTime as string | null) ?? null,
    bookingEndTime: (row.bookingEndTime as string | null) ?? null,
    bookingStatus: normalizeBookingStatus(row.bookingStatus),
    scheduledEndAt: toNullableIsoString(row.scheduledEndAt),
    canSend: canSendToThread(requestStatus, matchStatus),
    unreadCount: Number(row.unreadCount ?? 0),
    requesterReadAt: toNullableIsoString(row.requesterReadAt),
    providerReadAt: toNullableIsoString(row.providerReadAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

async function createThreadForMatchForUser(matchId: number, userId: string) {
  const sql = getSql();

  await ensureMessagingTables();
  const rows = await sql`
    INSERT INTO message_threads (
      service_request_id,
      request_provider_match_id,
      requester_user_id,
      provider_user_id,
      updated_at
    )
    SELECT
      sr.id,
      rpm.id,
      sr.requester_user_id,
      p.user_id,
      now()
    FROM request_provider_matches rpm
    JOIN service_requests sr ON sr.id = rpm.service_request_id
    JOIN provider_profiles p ON p.id = rpm.provider_profile_id
    WHERE rpm.id = ${matchId}
      AND (sr.requester_user_id = ${userId} OR p.user_id = ${userId})
    ON CONFLICT (request_provider_match_id) DO UPDATE SET
      service_request_id = EXCLUDED.service_request_id,
      requester_user_id = EXCLUDED.requester_user_id,
      provider_user_id = EXCLUDED.provider_user_id
    RETURNING id
  `;
  const record = (rows as Array<Record<string, unknown>>)[0];

  return record ? Number(record.id) : null;
}

export async function getMessageThreadForUser(threadId: number, userId: string) {
  const sql = getSql();

  await ensureMessagingTables();
  const rows = await sql`
    SELECT
      mt.id,
      mt.service_request_id as "serviceRequestId",
      mt.request_provider_match_id as "requestProviderMatchId",
      mt.requester_user_id as "requesterUserId",
      mt.provider_user_id as "providerUserId",
      mt.requester_read_at as "requesterReadAt",
      mt.provider_read_at as "providerReadAt",
      mt.updated_at as "updatedAt",
      sr.status as "requestStatus",
      sr.service_type as "serviceType",
      sr.zip_code as "zipCode",
      to_char(sr.requested_date, 'YYYY-MM-DD') as "requestedDate",
      to_char(sr.window_start_time, 'HH24:MI') as "windowStartTime",
      to_char(sr.window_end_time, 'HH24:MI') as "windowEndTime",
      sr.duration_minutes as "durationMinutes",
      sr.urgency,
      sr.contact_name as "requesterContactName",
      requester.name as "requesterAccountName",
      rpm.status as "matchStatus",
      rpm.match_source as "matchSource",
      to_char(rpm.proposed_date, 'YYYY-MM-DD') as "proposedDate",
      to_char(rpm.proposed_start_time, 'HH24:MI') as "proposedStartTime",
      to_char(rpm.proposed_end_time, 'HH24:MI') as "proposedEndTime",
      p.display_name as "providerDisplayName",
      provider_user.name as "providerAccountName",
      to_char(booking.booking_date, 'YYYY-MM-DD') as "bookingDate",
      to_char(booking.start_time, 'HH24:MI') as "bookingStartTime",
      to_char(booking.end_time, 'HH24:MI') as "bookingEndTime",
      booking.status as "bookingStatus",
      ((COALESCE(booking.booking_date, sr.requested_date) + COALESCE(booking.end_time, sr.window_end_time)) AT TIME ZONE 'America/Los_Angeles') as "scheduledEndAt",
      COALESCE(
        (
          SELECT count(*)::int
          FROM messages m
          WHERE m.message_thread_id = mt.id
            AND m.sender_user_id <> ${userId}
            AND m.created_at > COALESCE(
              CASE
                WHEN mt.requester_user_id = ${userId} THEN mt.requester_read_at
                ELSE mt.provider_read_at
              END,
              '-infinity'::timestamptz
            )
        ),
        0
      ) as "unreadCount"
    FROM message_threads mt
    JOIN service_requests sr ON sr.id = mt.service_request_id
    JOIN request_provider_matches rpm ON rpm.id = mt.request_provider_match_id
    JOIN provider_profiles p ON p.id = rpm.provider_profile_id
    LEFT JOIN LATERAL (
      SELECT
        sb.booking_date,
        sb.start_time,
        sb.end_time,
        sb.status,
        sb.created_at,
        sb.id
      FROM service_bookings sb
      WHERE sb.service_request_id = sr.id
        AND (sb.request_provider_match_id = rpm.id OR sb.provider_profile_id = p.id)
      ORDER BY sb.created_at DESC, sb.id DESC
      LIMIT 1
    ) booking ON true
    LEFT JOIN users requester ON requester.id = mt.requester_user_id
    LEFT JOIN users provider_user ON provider_user.id = mt.provider_user_id
    WHERE mt.id = ${threadId}
      AND (${userId} = mt.requester_user_id OR ${userId} = mt.provider_user_id)
    LIMIT 1
  `;
  const record = (rows as Array<Record<string, unknown>>)[0];

  return record ? toMessageThreadRecord(record, userId) : null;
}

export async function getMessagesForThreadForUser(threadId: number, userId: string) {
  const sql = getSql();

  await ensureMessagingTables();
  const rows = await sql`
    SELECT
      m.id,
      m.message_thread_id as "threadId",
      m.sender_user_id as "senderUserId",
      m.body,
      m.created_at as "createdAt"
    FROM messages m
    JOIN message_threads mt ON mt.id = m.message_thread_id
    WHERE mt.id = ${threadId}
      AND (${userId} = mt.requester_user_id OR ${userId} = mt.provider_user_id)
    ORDER BY m.created_at ASC, m.id ASC
  `;

  return (rows as Array<Record<string, unknown>>).map((row) => toMessageRecord(row));
}

export async function getMessageThreadBundleForMatchForUser(matchId: number, userId: string) {
  const threadId = await createThreadForMatchForUser(matchId, userId);

  if (!threadId) return null;

  const [thread, messages] = await Promise.all([
    getMessageThreadForUser(threadId, userId),
    getMessagesForThreadForUser(threadId, userId),
  ]);

  return thread ? { thread, messages } : null;
}

export async function getMessageThreadBundlesForMatchesForUser(matchIds: number[], userId: string) {
  const uniqueMatchIds = [...new Set(matchIds.filter((matchId) => Number.isInteger(matchId) && matchId > 0))];
  const bundles = await Promise.all(
    uniqueMatchIds.map((matchId) => getMessageThreadBundleForMatchForUser(matchId, userId)),
  );

  return bundles.filter((bundle): bundle is MessageThreadBundle => Boolean(bundle));
}

export async function getMessageInboxThreadBundlesForUser(userId: string) {
  const sql = getSql();

  await ensureMessagingTables();
  const rows = await sql`
    SELECT
      mt.id,
      mt.service_request_id as "serviceRequestId",
      mt.request_provider_match_id as "requestProviderMatchId",
      mt.requester_user_id as "requesterUserId",
      mt.provider_user_id as "providerUserId",
      mt.requester_read_at as "requesterReadAt",
      mt.provider_read_at as "providerReadAt",
      mt.updated_at as "updatedAt",
      sr.status as "requestStatus",
      sr.service_type as "serviceType",
      sr.zip_code as "zipCode",
      to_char(sr.requested_date, 'YYYY-MM-DD') as "requestedDate",
      to_char(sr.window_start_time, 'HH24:MI') as "windowStartTime",
      to_char(sr.window_end_time, 'HH24:MI') as "windowEndTime",
      sr.duration_minutes as "durationMinutes",
      sr.urgency,
      sr.contact_name as "requesterContactName",
      requester.name as "requesterAccountName",
      rpm.status as "matchStatus",
      rpm.match_source as "matchSource",
      to_char(rpm.proposed_date, 'YYYY-MM-DD') as "proposedDate",
      to_char(rpm.proposed_start_time, 'HH24:MI') as "proposedStartTime",
      to_char(rpm.proposed_end_time, 'HH24:MI') as "proposedEndTime",
      p.display_name as "providerDisplayName",
      provider_user.name as "providerAccountName",
      to_char(booking.booking_date, 'YYYY-MM-DD') as "bookingDate",
      to_char(booking.start_time, 'HH24:MI') as "bookingStartTime",
      to_char(booking.end_time, 'HH24:MI') as "bookingEndTime",
      booking.status as "bookingStatus",
      ((COALESCE(booking.booking_date, sr.requested_date) + COALESCE(booking.end_time, sr.window_end_time)) AT TIME ZONE 'America/Los_Angeles') as "scheduledEndAt",
      latest_message.id as "latestMessageId",
      latest_message.message_thread_id as "latestMessageThreadId",
      latest_message.sender_user_id as "latestMessageSenderUserId",
      latest_message.body as "latestMessageBody",
      latest_message.created_at as "latestMessageCreatedAt",
      COALESCE(
        (
          SELECT count(*)::int
          FROM messages m
          WHERE m.message_thread_id = mt.id
            AND m.sender_user_id <> ${userId}
            AND m.created_at > COALESCE(
              CASE
                WHEN mt.requester_user_id = ${userId} THEN mt.requester_read_at
                ELSE mt.provider_read_at
              END,
              '-infinity'::timestamptz
            )
        ),
        0
      ) as "unreadCount"
    FROM message_threads mt
    JOIN service_requests sr ON sr.id = mt.service_request_id
    JOIN request_provider_matches rpm ON rpm.id = mt.request_provider_match_id
    JOIN provider_profiles p ON p.id = rpm.provider_profile_id
    LEFT JOIN LATERAL (
      SELECT
        sb.booking_date,
        sb.start_time,
        sb.end_time,
        sb.status,
        sb.created_at,
        sb.id
      FROM service_bookings sb
      WHERE sb.service_request_id = sr.id
        AND (sb.request_provider_match_id = rpm.id OR sb.provider_profile_id = p.id)
      ORDER BY sb.created_at DESC, sb.id DESC
      LIMIT 1
    ) booking ON true
    LEFT JOIN users requester ON requester.id = mt.requester_user_id
    LEFT JOIN users provider_user ON provider_user.id = mt.provider_user_id
    LEFT JOIN LATERAL (
      SELECT
        m.id,
        m.message_thread_id,
        m.sender_user_id,
        m.body,
        m.created_at
      FROM messages m
      WHERE m.message_thread_id = mt.id
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT 1
    ) latest_message ON true
    WHERE ${userId} = mt.requester_user_id OR ${userId} = mt.provider_user_id
    ORDER BY COALESCE(latest_message.created_at, mt.updated_at) DESC, mt.id DESC
  `;
  const records = rows as Array<Record<string, unknown>>;
  const threads = records.map((record) => toMessageThreadRecord(record, userId));
  const messageLists = await Promise.all(
    threads.map((thread) => getMessagesForThreadForUser(thread.id, userId)),
  );

  return threads.map((thread, index) => {
    const record = records[index];
    const latestMessage = record.latestMessageId
      ? toMessageRecord({
          id: record.latestMessageId,
          threadId: record.latestMessageThreadId,
          senderUserId: record.latestMessageSenderUserId,
          body: record.latestMessageBody,
          createdAt: record.latestMessageCreatedAt,
        })
      : null;

    return {
      thread,
      messages: messageLists[index],
      latestMessage,
    } satisfies MessageInboxThreadBundle;
  });
}

export async function getUnreadMessageThreadCount(userId: string) {
  const sql = getSql();

  await ensureMessagingTables();
  const rows = await sql`
    SELECT count(*)::int as count
    FROM message_threads mt
    WHERE (
      mt.requester_user_id = ${userId}
      AND EXISTS (
        SELECT 1
        FROM messages m
        WHERE m.message_thread_id = mt.id
          AND m.sender_user_id <> ${userId}
          AND m.created_at > COALESCE(mt.requester_read_at, '-infinity'::timestamptz)
      )
    ) OR (
      mt.provider_user_id = ${userId}
      AND EXISTS (
        SELECT 1
        FROM messages m
        WHERE m.message_thread_id = mt.id
          AND m.sender_user_id <> ${userId}
          AND m.created_at > COALESCE(mt.provider_read_at, '-infinity'::timestamptz)
      )
    )
  `;
  const record = (rows as Array<Record<string, unknown>>)[0];

  return record ? Number(record.count) : 0;
}

export async function markMessageThreadReadForUser(threadId: number, userId: string) {
  const sql = getSql();

  await ensureMessagingTables();
  const rows = await sql`
    UPDATE message_threads
    SET
      requester_read_at = CASE
        WHEN requester_user_id = ${userId} THEN now()
        ELSE requester_read_at
      END,
      provider_read_at = CASE
        WHEN provider_user_id = ${userId} THEN now()
        ELSE provider_read_at
      END
    WHERE id = ${threadId}
      AND (${userId} = requester_user_id OR ${userId} = provider_user_id)
    RETURNING
      service_request_id as "serviceRequestId",
      request_provider_match_id as "requestProviderMatchId"
  `;
  const record = (rows as Array<Record<string, unknown>>)[0];

  return record
    ? {
        serviceRequestId: Number(record.serviceRequestId),
        requestProviderMatchId: Number(record.requestProviderMatchId),
      }
    : null;
}

export async function insertMessageForUser(threadId: number, userId: string, body: string) {
  const pool = getPool();
  const client = await pool.connect();
  let didBegin = false;

  await ensureMessagingTables();

  try {
    await client.query("BEGIN");
    didBegin = true;
    const threadResult = await client.query(
      `
        SELECT
          mt.id,
          mt.service_request_id as "serviceRequestId",
          mt.request_provider_match_id as "requestProviderMatchId",
          mt.requester_user_id as "requesterUserId",
          mt.provider_user_id as "providerUserId",
          mt.requester_read_at as "requesterReadAt",
          mt.provider_read_at as "providerReadAt",
          mt.updated_at as "updatedAt",
          sr.status as "requestStatus",
          sr.service_type as "serviceType",
          sr.zip_code as "zipCode",
          to_char(sr.requested_date, 'YYYY-MM-DD') as "requestedDate",
          to_char(sr.window_start_time, 'HH24:MI') as "windowStartTime",
          to_char(sr.window_end_time, 'HH24:MI') as "windowEndTime",
          sr.duration_minutes as "durationMinutes",
          sr.urgency,
          sr.contact_name as "requesterContactName",
          requester.name as "requesterAccountName",
          rpm.status as "matchStatus",
          rpm.match_source as "matchSource",
          to_char(rpm.proposed_date, 'YYYY-MM-DD') as "proposedDate",
          to_char(rpm.proposed_start_time, 'HH24:MI') as "proposedStartTime",
          to_char(rpm.proposed_end_time, 'HH24:MI') as "proposedEndTime",
          p.display_name as "providerDisplayName",
          provider_user.name as "providerAccountName",
          to_char(booking.booking_date, 'YYYY-MM-DD') as "bookingDate",
          to_char(booking.start_time, 'HH24:MI') as "bookingStartTime",
          to_char(booking.end_time, 'HH24:MI') as "bookingEndTime",
          booking.status as "bookingStatus",
          ((COALESCE(booking.booking_date, sr.requested_date) + COALESCE(booking.end_time, sr.window_end_time)) AT TIME ZONE 'America/Los_Angeles') as "scheduledEndAt",
          0 as "unreadCount"
        FROM message_threads mt
        JOIN service_requests sr ON sr.id = mt.service_request_id
        JOIN request_provider_matches rpm ON rpm.id = mt.request_provider_match_id
        JOIN provider_profiles p ON p.id = rpm.provider_profile_id
        LEFT JOIN LATERAL (
          SELECT
            sb.booking_date,
            sb.start_time,
            sb.end_time,
            sb.status,
            sb.created_at,
            sb.id
          FROM service_bookings sb
          WHERE sb.service_request_id = sr.id
            AND (sb.request_provider_match_id = rpm.id OR sb.provider_profile_id = p.id)
          ORDER BY sb.created_at DESC, sb.id DESC
          LIMIT 1
        ) booking ON true
        LEFT JOIN users requester ON requester.id = mt.requester_user_id
        LEFT JOIN users provider_user ON provider_user.id = mt.provider_user_id
        WHERE mt.id = $1
          AND ($2 = mt.requester_user_id OR $2 = mt.provider_user_id)
        FOR UPDATE OF mt
      `,
      [threadId, userId],
    );
    const threadRow = threadResult.rows[0] as Record<string, unknown> | undefined;

    if (!threadRow) {
      await client.query("ROLLBACK");
      didBegin = false;
      return null;
    }

    const requestStatus = normalizeRequestStatus(threadRow.requestStatus);
    const matchStatus = normalizeMatchStatus(threadRow.matchStatus);

    if (!canSendToThread(requestStatus, matchStatus)) {
      await client.query("ROLLBACK");
      didBegin = false;
      return null;
    }

    const inserted = await client.query(
      `
        INSERT INTO messages (message_thread_id, sender_user_id, body)
        VALUES ($1, $2, $3)
        RETURNING
          id,
          message_thread_id as "threadId",
          sender_user_id as "senderUserId",
          body,
          created_at as "createdAt"
      `,
      [threadId, userId, body],
    );

    await client.query(
      `
        UPDATE message_threads
        SET
          updated_at = now(),
          requester_read_at = CASE
            WHEN requester_user_id = $2 THEN now()
            ELSE requester_read_at
          END,
          provider_read_at = CASE
            WHEN provider_user_id = $2 THEN now()
            ELSE provider_read_at
          END
        WHERE id = $1
      `,
      [threadId, userId],
    );

    await client.query("COMMIT");
    didBegin = false;

    const message = toMessageRecord(inserted.rows[0] as Record<string, unknown>);
    const thread = toMessageThreadRecord(
      {
        ...threadRow,
        requestStatus,
        matchStatus,
        updatedAt: new Date().toISOString(),
      },
      userId,
    );
    const senderIsRequester = userId === thread.requesterUserId;
    const senderName = senderIsRequester
      ? String(threadRow.requesterContactName || threadRow.requesterAccountName || "Requester")
      : String(threadRow.providerDisplayName || threadRow.providerAccountName || "Provider");

    return {
      message,
      thread,
      recipientUserId: senderIsRequester ? thread.providerUserId : thread.requesterUserId,
      senderName,
    } satisfies MessageSendResult;
  } catch (error) {
    if (didBegin) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }
}
