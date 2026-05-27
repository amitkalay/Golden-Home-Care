import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("auth and account flow source checks", () => {
  it("defaults sessions to general users and does not create provider drafts during sign in", async () => {
    const auth = await readFile(new URL("../src/app/lib/auth.ts", import.meta.url), "utf8");
    const database = await readFile(new URL("../src/app/lib/database.ts", import.meta.url), "utf8");

    assert.match(auth, /token\.role = role === "provider" \? "provider" : "user"/);
    assert.match(auth, /session\.user\.role = token\.role === "provider" \? "provider" : "user"/);
    assert.match(auth, /secret: getAuthSecret\(\)/);
    assert.equal(auth.includes("ensureProviderTables"), false);
    assert.match(database, /role text not null default 'user'/);
    assert.match(database, /ALTER COLUMN role SET DEFAULT 'user'/);
  });

  it("shows signed-in and signed-out landing header branches", async () => {
    const homepage = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");

    assert.match(homepage, /getCurrentUserSession/);
    assert.match(homepage, /Hello, \{userName\}/);
    assert.match(homepage, /callbackUrl="\/"/);
    assert.match(homepage, /\/sign-in\?callbackUrl=\/provider\/onboarding/);
  });

  it("creates provider drafts only from provider entry points", async () => {
    const providerActions = await readFile(new URL("../src/app/provider/actions.ts", import.meta.url), "utf8");
    const providerPage = await readFile(new URL("../src/app/provider/page.tsx", import.meta.url), "utf8");
    const providerOnboarding = await readFile(new URL("../src/app/provider/onboarding/page.tsx", import.meta.url), "utf8");
    const providerDb = await readFile(new URL("../src/app/provider/db.ts", import.meta.url), "utf8");

    assert.match(providerActions, /ensureDraftProviderProfile\(userId, session\?\.user\?\.name\)/);
    assert.match(providerPage, /ensureDraftProviderProfile\(session\.user\.id, session\.user\.name\)/);
    assert.match(providerOnboarding, /ensureDraftProviderProfile\(session\.user\.id, session\.user\.name\)/);
    assert.match(providerDb, /INSERT INTO provider_profiles \(user_id, display_name, status\)/);
    assert.match(providerDb, /SET role = 'provider'/);
    assert.equal(providerDb.includes("photo_url, status"), false);
  });

  it("uses the account delete helper and relies on cascade deletion", async () => {
    const accountActions = await readFile(new URL("../src/app/account/actions.ts", import.meta.url), "utf8");

    assert.match(accountActions, /deleteUserAccount\(user\.id\)/);
    assert.match(accountActions, /"next-auth\.session-token"/);
    assert.match(accountActions, /cookieStore\.delete\(cookieName\)/);
    assert.equal(accountActions.includes("DELETE FROM provider_profiles"), false);
    assert.equal(accountActions.includes("DELETE FROM provider_services"), false);
    assert.equal(accountActions.includes("DELETE FROM accounts"), false);
  });
});
