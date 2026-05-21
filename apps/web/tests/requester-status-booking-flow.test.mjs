import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("requester status and booking flow source checks", () => {
  it("protects requester request status pages through account middleware", async () => {
    const proxy = await readFile(new URL("../src/proxy.ts", import.meta.url), "utf8");
    const accountRequestsPage = await readFile(
      new URL("../src/app/account/requests/page.tsx", import.meta.url),
      "utf8",
    );

    assert.match(proxy, /"\/account\/:path\*"/);
    assert.match(accountRequestsPage, /requireUser\(\)/);
    assert.match(accountRequestsPage, /getServiceRequestsForRequester\(user\.id\)/);
    assert.match(accountRequestsPage, /provider-inbox-tabs/);
  });

  it("scopes requester request listing and cancellation to the signed-in requester", async () => {
    const requestDb = await readFile(new URL("../src/app/requests/db.ts", import.meta.url), "utf8");
    const requestActions = await readFile(new URL("../src/app/requests/actions.ts", import.meta.url), "utf8");

    assert.match(requestDb, /WHERE sr\.requester_user_id = \$\{requesterUserId\}/);
    assert.match(requestDb, /requester_user_id = \$2/);
    assert.match(requestDb, /status not in \('completed', 'canceled'\)/);
    assert.match(requestActions, /cancelServiceRequestForRequester\(requestId, user\.id\)/);
  });

  it("adds booking persistence and expanded request statuses", async () => {
    const database = await readFile(new URL("../src/app/lib/database.ts", import.meta.url), "utf8");

    assert.match(database, /CREATE TABLE IF NOT EXISTS service_bookings/);
    assert.match(database, /status in \('submitted', 'confirmed', 'completed', 'canceled'\)/);
    assert.match(database, /service_bookings_provider_time_idx/);
  });

  it("provider acceptance confirms a booking and expires overlapping work", async () => {
    const providerDb = await readFile(new URL("../src/app/provider/db.ts", import.meta.url), "utf8");

    assert.match(providerDb, /FROM service_bookings/);
    assert.match(providerDb, /status = 'confirmed'/);
    assert.match(providerDb, /INSERT INTO service_bookings/);
    assert.match(providerDb, /UPDATE service_requests/);
    assert.match(providerDb, /sr\.window_start_time < \$5/);
    assert.match(providerDb, /sr\.window_end_time > \$4/);
  });

  it("request matching excludes providers with overlapping confirmed bookings", async () => {
    const requestDb = await readFile(new URL("../src/app/requests/db.ts", import.meta.url), "utf8");
    const matching = await readFile(new URL("../src/app/requests/matching.js", import.meta.url), "utf8");

    assert.match(requestDb, /FROM service_bookings sb/);
    assert.match(requestDb, /sb\.status = 'confirmed'/);
    assert.match(matching, /hasOverlappingConfirmedBooking/);
    assert.match(matching, /booking\.startTime < request\.windowEndTime/);
    assert.match(matching, /booking\.endTime > request\.windowStartTime/);
  });
});
