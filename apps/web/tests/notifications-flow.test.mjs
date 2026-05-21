import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("notification source checks", () => {
  it("adds notification persistence with scoped unread reads and email status tracking", async () => {
    const database = await readFile(new URL("../src/app/lib/database.ts", import.meta.url), "utf8");
    const notificationDb = await readFile(new URL("../src/app/notifications/db.ts", import.meta.url), "utf8");

    assert.match(database, /CREATE TABLE IF NOT EXISTS notifications/);
    assert.match(database, /recipient_user_id text not null references users\(id\)/);
    assert.match(database, /email_status in \('not_applicable', 'pending', 'sent', 'failed', 'skipped'\)/);
    assert.match(database, /notifications_recipient_unread_idx/);
    assert.match(notificationDb, /WHERE recipient_user_id = \$\{userId\}/);
    assert.match(notificationDb, /AND read_at IS NULL/);
    assert.match(notificationDb, /markNotificationReadForUser/);
    assert.match(notificationDb, /recipient_user_id = \$\{userId\}/);
  });

  it("protects the notifications page and scopes mark-read actions to the signed-in user", async () => {
    const proxy = await readFile(new URL("../src/proxy.ts", import.meta.url), "utf8");
    const page = await readFile(new URL("../src/app/account/notifications/page.tsx", import.meta.url), "utf8");
    const actions = await readFile(new URL("../src/app/notifications/actions.ts", import.meta.url), "utf8");

    assert.match(proxy, /"\/account\/:path\*"/);
    assert.match(page, /requireUser\(\)/);
    assert.match(page, /getUserNotifications\(user\.id, filter\)/);
    assert.match(page, /markAllNotificationsRead/);
    assert.match(page, /markNotificationRead/);
    assert.match(actions, /requireUser\(\)/);
    assert.match(actions, /markNotificationReadForUser\(user\.id, notificationId\)/);
    assert.match(actions, /markAllNotificationsReadForUser\(user\.id\)/);
  });

  it("wires request lifecycle notifications without blocking saved actions", async () => {
    const requestActions = await readFile(new URL("../src/app/requests/actions.ts", import.meta.url), "utf8");
    const providerActions = await readFile(new URL("../src/app/provider/actions.ts", import.meta.url), "utf8");
    const requestDb = await readFile(new URL("../src/app/requests/db.ts", import.meta.url), "utf8");

    assert.match(requestActions, /notifyProvidersOfNewRequest\(requestId\)/);
    assert.match(requestActions, /notifyProvidersOfRequesterCancellation\(updateResult\.affectedMatchIds\)/);
    assert.match(providerActions, /notifyAfterProviderAccepted\(matchId\)/);
    assert.match(providerActions, /notifyRequesterOfProviderDecline\(matchId\)/);
    assert.match(providerActions, /notifyRequesterOfProviderProposal\(result\.data\.matchId\)/);
    assert.match(requestActions, /Failed to notify matched providers/);
    assert.match(providerActions, /Failed to send provider acceptance notifications/);
    assert.match(requestDb, /affectedMatchIds/);
    assert.match(requestDb, /rpm\.status in \('pending', 'proposed', 'accepted'\)/);
  });

  it("sends email through Resend using users.email and records skipped or failed delivery", async () => {
    const packageJson = await readFile(new URL("../../../package.json", import.meta.url), "utf8");
    const webPackageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
    const notificationDb = await readFile(new URL("../src/app/notifications/db.ts", import.meta.url), "utf8");

    assert.match(packageJson, /"workspaces"/);
    assert.match(webPackageJson, /"resend"/);
    assert.match(notificationDb, /import \{ Resend \} from "resend"/);
    assert.match(notificationDb, /FROM users u/);
    assert.match(notificationDb, /CASE WHEN \$\{input\.sendEmail \? true : false\} THEN u\.email ELSE NULL END/);
    assert.match(notificationDb, /process\.env\.RESEND_API_KEY/);
    assert.match(notificationDb, /process\.env\.NOTIFICATIONS_FROM_EMAIL/);
    assert.match(notificationDb, /process\.env\.APP_BASE_URL/);
    assert.match(notificationDb, /idempotencyKey: payload\.dedupeKey/);
    assert.match(notificationDb, /updateNotificationEmailStatus\(payload\.id, "skipped"\)/);
    assert.match(notificationDb, /updateNotificationEmailStatus\(\s*payload\.id,\s*"failed"/);
  });

  it("keeps provider new-request notifications private before acceptance", async () => {
    const notificationDb = await readFile(new URL("../src/app/notifications/db.ts", import.meta.url), "utf8");
    const start = notificationDb.indexOf("export async function notifyProvidersOfNewRequest");
    const end = notificationDb.indexOf("export async function notifyAfterProviderAccepted");
    const providerNewRequestBlock = notificationDb.slice(start, end);

    assert.ok(start >= 0);
    assert.ok(end > start);
    assert.match(providerNewRequestBlock, /provider_new_request/);
    assert.match(providerNewRequestBlock, /rpm\.status = 'pending'/);
    assert.doesNotMatch(providerNewRequestBlock, /contact_email/);
    assert.doesNotMatch(providerNewRequestBlock, /contact_phone/);
  });
});
