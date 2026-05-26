import { ensureMessagingTables, getPool, getSql } from "../lib/database";

export type MessageThreadRole = "requester" | "provider";
export type MessageThreadRecord = {
  id: number;
  serviceRequestId: number;
  requestProviderMatchId: number;
  requesterUserId: string;
  providerUserId: string;
  role: MessageThreadRole;
  otherParticipantName: string;
  requestStatus: "submitted" | "confirmed" | "completed" | "canceled";
  matchStatus: "pending" | "proposed" | "accepted" | "declined" | "expired";
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
  if (status === "confirmed" || status === "completed" || status === "canceled") {
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
      sr.contact_name as "requesterContactName",
      requester.name as "requesterAccountName",
      rpm.status as "matchStatus",
      p.display_name as "providerDisplayName",
      provider_user.name as "providerAccountName",
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
          sr.contact_name as "requesterContactName",
          requester.name as "requesterAccountName",
          rpm.status as "matchStatus",
          p.display_name as "providerDisplayName",
          provider_user.name as "providerAccountName",
          0 as "unreadCount"
        FROM message_threads mt
        JOIN service_requests sr ON sr.id = mt.service_request_id
        JOIN request_provider_matches rpm ON rpm.id = mt.request_provider_match_id
        JOIN provider_profiles p ON p.id = rpm.provider_profile_id
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
