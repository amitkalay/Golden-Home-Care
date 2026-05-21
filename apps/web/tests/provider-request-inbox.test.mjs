import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("provider request inbox source checks", () => {
  it("renders provider-scoped request matches with inbox actions", async () => {
    const page = await readFile(new URL("../src/app/provider/messages/page.tsx", import.meta.url), "utf8");
    const db = await readFile(new URL("../src/app/provider/db.ts", import.meta.url), "utf8");

    assert.match(page, /getServerSession\(authOptions\)/);
    assert.match(page, /ensureDraftProviderProfile\(session\.user\.id, session\.user\.name\)/);
    assert.match(page, /getProviderRequestInbox\(session\.user\.id\)/);
    assert.match(page, /acceptProviderRequestMatch/);
    assert.match(page, /declineProviderRequestMatch/);
    assert.match(page, /proposeProviderRequestTime/);
    assert.match(page, /provider-inbox-tabs/);
    assert.match(db, /FROM request_provider_matches rpm/);
    assert.match(db, /WHERE p\.user_id = \$\{userId\}/);
  });

  it("hides requester contact fields until the provider accepts", async () => {
    const db = await readFile(new URL("../src/app/provider/db.ts", import.meta.url), "utf8");

    assert.match(db, /CASE WHEN rpm\.status = 'accepted' THEN sr\.contact_email ELSE NULL END/);
    assert.match(db, /CASE WHEN rpm\.status = 'accepted' THEN sr\.contact_phone ELSE NULL END/);
  });

  it("scopes response actions to pending matches owned by the provider", async () => {
    const actions = await readFile(new URL("../src/app/provider/actions.ts", import.meta.url), "utf8");
    const db = await readFile(new URL("../src/app/provider/db.ts", import.meta.url), "utf8");

    assert.match(actions, /parseProviderRequestProposalForm\(formData\)/);
    assert.match(actions, /parseProviderMatchId\(formData\)/);
    assert.match(db, /AND p\.user_id = \$2/);
    assert.match(db, /AND p\.user_id = \$\{userId\}/);
    assert.match(db, /AND rpm\.status = 'pending'/);
  });

  it("accepting a request expires competing pending or proposed matches", async () => {
    const db = await readFile(new URL("../src/app/provider/db.ts", import.meta.url), "utf8");

    assert.match(db, /status = 'accepted'/);
    assert.match(db, /status = 'expired'/);
    assert.match(db, /service_request_id = \$1/);
    assert.match(db, /status in \('pending', 'proposed'\)/);
  });
});
