import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("feedback email source checks", () => {
  it("sends public feedback to Amit through Resend with optional reply-to and attachments", async () => {
    const actions = await readFile(new URL("../src/app/feedback/actions.ts", import.meta.url), "utf8");
    const validation = await readFile(new URL("../src/app/feedback/validation.js", import.meta.url), "utf8");

    assert.match(validation, /FEEDBACK_RECIPIENT_EMAIL = "amitkalay8@gmail\.com"/);
    assert.match(actions, /import \{ Resend \} from "resend"/);
    assert.match(actions, /process\.env\.RESEND_API_KEY/);
    assert.match(actions, /process\.env\.NOTIFICATIONS_FROM_EMAIL/);
    assert.match(actions, /to: FEEDBACK_RECIPIENT_EMAIL/);
    assert.match(actions, /replyTo: result\.data\.email \|\| undefined/);
    assert.match(actions, /attachments/);
    assert.match(actions, /Buffer\.from\(await image\.arrayBuffer\(\)\)/);
    assert.match(actions, /result\.data\.website/);
    assert.match(actions, /\/feedback\?status=sent/);
    assert.match(actions, /\/feedback\?status=invalid/);
    assert.match(actions, /\/feedback\?status=error/);
  });
});
