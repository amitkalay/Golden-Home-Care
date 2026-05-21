import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("service request flow source checks", () => {
  it("protects request routes with auth middleware", async () => {
    const proxy = await readFile(new URL("../src/proxy.ts", import.meta.url), "utf8");

    assert.match(proxy, /"\/requests\/:path\*"/);
  });

  it("links provider search and provider cards to the request form", async () => {
    const providersPage = await readFile(new URL("../src/app/providers/page.tsx", import.meta.url), "utf8");

    assert.match(providersPage, /buildRequestHref/);
    assert.match(providersPage, /\/requests\/new/);
    assert.match(providersPage, /matchPreference: "any"/);
    assert.match(providersPage, /matchPreference: "specific"/);
    assert.match(providersPage, /providerId: provider\.id/);
    assert.match(providersPage, /Request service/);
  });

  it("prefills requester contact and creates requests through a server action", async () => {
    const newRequestPage = await readFile(new URL("../src/app/requests/new/page.tsx", import.meta.url), "utf8");
    const actions = await readFile(new URL("../src/app/requests/actions.ts", import.meta.url), "utf8");
    const db = await readFile(new URL("../src/app/requests/db.ts", import.meta.url), "utf8");

    assert.match(newRequestPage, /requireUser\(\)/);
    assert.match(newRequestPage, /getUserAccount\(user\.id\)/);
    assert.match(newRequestPage, /defaultValue=\{contactName\}/);
    assert.match(newRequestPage, /defaultValue=\{contactEmail\}/);
    assert.match(actions, /parseServiceRequestForm\(formData\)/);
    assert.match(actions, /geocodeZipCode\(result\.data\.zipCode\)/);
    assert.match(actions, /redirect\(`\/requests\/\$\{requestId\}`\)/);
    assert.match(db, /findRequestProviderMatches/);
    assert.match(db, /INSERT INTO request_provider_matches/);
  });

  it("scopes confirmation page lookup to the signed-in requester", async () => {
    const confirmationPage = await readFile(new URL("../src/app/requests/[id]/page.tsx", import.meta.url), "utf8");
    const db = await readFile(new URL("../src/app/requests/db.ts", import.meta.url), "utf8");

    assert.match(confirmationPage, /requireUser\(\)/);
    assert.match(confirmationPage, /getServiceRequestForRequester\(requestId, user\.id\)/);
    assert.match(confirmationPage, /formatRequestStatus\(request\.status\)/);
    assert.match(confirmationPage, /request\.matches/);
    assert.match(db, /request_provider_matches/);
    assert.match(db, /sr\.requester_user_id = \$\{requesterUserId\}/);
  });
});
