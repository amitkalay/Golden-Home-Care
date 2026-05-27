import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMessageBody, MAX_MESSAGE_BODY_LENGTH } from "../src/app/messages/validation.js";

describe("message validation", () => {
  it("accepts and trims valid text-only messages", () => {
    const result = parseMessageBody({ body: "  Hello there  " });

    assert.equal(result.ok, true);
    assert.equal(result.data.body, "Hello there");
  });

  it("rejects blank and overlong messages", () => {
    const blank = parseMessageBody({ body: "   " });
    const tooLong = parseMessageBody({ body: "a".repeat(MAX_MESSAGE_BODY_LENGTH + 1) });

    assert.equal(blank.ok, false);
    assert.equal(blank.errors.body, "Required");
    assert.equal(tooLong.ok, false);
    assert.equal(tooLong.errors.body, "Too long");
  });
});

describe("realtime request messaging source checks", () => {
  it("adds messaging persistence keyed to request provider matches", async () => {
    const database = await readFile(new URL("../src/app/lib/database.ts", import.meta.url), "utf8");
    const requestDb = await readFile(new URL("../src/app/requests/db.ts", import.meta.url), "utf8");

    assert.match(database, /let messagingTablesReady/);
    assert.match(database, /export async function ensureMessagingTables/);
    assert.match(database, /CREATE TABLE IF NOT EXISTS message_threads/);
    assert.match(database, /request_provider_match_id bigint not null unique references request_provider_matches/);
    assert.match(database, /CREATE TABLE IF NOT EXISTS messages/);
    assert.match(database, /messages_body_check/);
    assert.match(database, /message_threads_requester_idx/);
    assert.match(database, /messages_thread_created_idx/);
    assert.match(requestDb, /INSERT INTO message_threads/);
    assert.match(requestDb, /ON CONFLICT \(request_provider_match_id\) DO NOTHING/);
  });

  it("keeps Pusher initialization lazy and authorizes private message channels", async () => {
    const realtime = await readFile(new URL("../src/app/lib/realtime.ts", import.meta.url), "utf8");
    const authRoute = await readFile(new URL("../src/app/api/pusher/auth/route.ts", import.meta.url), "utf8");

    assert.match(realtime, /let pusherClient: Pusher \| null = null/);
    assert.match(realtime, /export function getPusherServer/);
    assert.match(realtime, /process\.env\.PUSHER_APP_ID/);
    assert.match(realtime, /new Pusher/);
    assert.match(realtime, /private-message-thread-\$\{threadId\}/);
    assert.match(authRoute, /getServerSession\(authOptions\)/);
    assert.match(authRoute, /parseMessageThreadChannelName\(channelName\)/);
    assert.match(authRoute, /getMessageThreadForUser\(threadId, userId\)/);
    assert.match(authRoute, /pusher\.authorizeChannel\(socketId, channelName\)/);
  });

  it("scopes thread reads and sends to the requester or matched provider", async () => {
    const messageDb = await readFile(new URL("../src/app/messages/db.ts", import.meta.url), "utf8");
    const sendRoute = await readFile(new URL("../src/app/api/messages/send/route.ts", import.meta.url), "utf8");
    const readRoute = await readFile(new URL("../src/app/api/messages/read/route.ts", import.meta.url), "utf8");

    assert.match(messageDb, /sr\.requester_user_id = \$\{userId\} OR p\.user_id = \$\{userId\}/);
    assert.match(messageDb, /\$\{userId\} = mt\.requester_user_id OR \$\{userId\} = mt\.provider_user_id/);
    assert.match(messageDb, /\$2 = mt\.requester_user_id OR \$2 = mt\.provider_user_id/);
    assert.match(messageDb, /requestStatus !== "completed"/);
    assert.match(messageDb, /requestStatus !== "canceled"/);
    assert.match(messageDb, /matchStatus === "pending"/);
    assert.match(messageDb, /matchStatus === "proposed"/);
    assert.match(messageDb, /matchStatus === "accepted"/);
    assert.match(sendRoute, /insertMessageForUser\(threadId, userId, parsedMessage\.data\.body\)/);
    assert.match(readRoute, /markMessageThreadReadForUser\(threadId, userId\)/);
  });

  it("creates in-app-only notifications and marks message notifications read", async () => {
    const notificationDb = await readFile(new URL("../src/app/notifications/db.ts", import.meta.url), "utf8");
    const sendRoute = await readFile(new URL("../src/app/api/messages/send/route.ts", import.meta.url), "utf8");
    const readRoute = await readFile(new URL("../src/app/api/messages/read/route.ts", import.meta.url), "utf8");

    assert.match(notificationDb, /export async function notifyRecipientOfMessage/);
    assert.match(notificationDb, /type: "message_received"/);
    assert.match(notificationDb, /dedupeKey: `message:\$\{messageId\}:recipient`/);
    assert.match(notificationDb, /sendEmail: false/);
    assert.match(notificationDb, /export async function markMessageNotificationsReadForUser/);
    assert.match(notificationDb, /AND type = 'message_received'/);
    assert.match(sendRoute, /notifyRecipientOfMessage/);
    assert.match(readRoute, /markMessageNotificationsReadForUser/);
  });

  it("wires requester and provider UI to the realtime message thread", async () => {
    const threadComponent = await readFile(
      new URL("../src/app/messages/message-thread.tsx", import.meta.url),
      "utf8",
    );
    const inboxPopover = await readFile(
      new URL("../src/app/messages/inbox-popover.tsx", import.meta.url),
      "utf8",
    );
    const messageDb = await readFile(new URL("../src/app/messages/db.ts", import.meta.url), "utf8");
    const homepage = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
    const requestPage = await readFile(new URL("../src/app/requests/[id]/page.tsx", import.meta.url), "utf8");
    const providerPage = await readFile(new URL("../src/app/provider/messages/page.tsx", import.meta.url), "utf8");
    const accountRequestsPage = await readFile(
      new URL("../src/app/account/requests/page.tsx", import.meta.url),
      "utf8",
    );

    assert.match(threadComponent, /"use client"/);
    assert.match(threadComponent, /import Pusher from "pusher-js"/);
    assert.match(threadComponent, /NEXT_PUBLIC_PUSHER_KEY/);
    assert.match(threadComponent, /private-message-thread-\$\{thread\.id\}/);
    assert.match(threadComponent, /\/api\/messages\/send/);
    assert.match(threadComponent, /\/api\/messages\/read/);
    assert.match(messageDb, /export async function getMessageInboxThreadBundlesForUser/);
    assert.match(messageDb, /LEFT JOIN LATERAL/);
    assert.match(messageDb, /ORDER BY COALESCE\(latest_message\.created_at, mt\.updated_at\) DESC/);
    assert.match(homepage, /getMessageInboxThreadBundlesForUser\(session\.user\.id\)/);
    assert.match(homepage, /<InboxPopover/);
    assert.match(inboxPopover, /"use client"/);
    assert.match(inboxPopover, /Search messages/);
    assert.match(inboxPopover, /setFilter\("unread"\)/);
    assert.match(inboxPopover, /function openThread\(threadId: number\)/);
    assert.match(inboxPopover, /\/api\/messages\/read/);
    assert.match(inboxPopover, /<MessageThread/);
    assert.match(requestPage, /getMessageThreadBundlesForMatchesForUser/);
    assert.match(requestPage, /<MessageThread/);
    assert.match(providerPage, /getMessageThreadBundlesForMatchesForUser/);
    assert.match(providerPage, /<MessageThread/);
    assert.match(accountRequestsPage, /messageUnreadCount/);
    assert.match(accountRequestsPage, /#message-thread-\$\{messageMatch\.id\}/);
  });
});
