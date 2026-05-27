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

  it("loads the next non-stale confirmed visit for landing page users", async () => {
    const requestDb = await readFile(new URL("../src/app/requests/db.ts", import.meta.url), "utf8");
    const homepage = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
    const upcomingVisitCard = await readFile(
      new URL("../src/app/upcoming-visit-card.tsx", import.meta.url),
      "utf8",
    );

    assert.match(requestDb, /export type UpcomingVisitRecord/);
    assert.match(requestDb, /export async function getNextUpcomingVisitForUser\(userId: string\)/);
    assert.match(requestDb, /WHERE sb\.status = 'confirmed'/);
    assert.match(requestDb, /sr\.requester_user_id = \$\{userId\} OR p\.user_id = \$\{userId\}/);
    assert.match(requestDb, /sb\.booking_date \+ sb\.end_time\) > \(now\(\) AT TIME ZONE 'America\/Los_Angeles'\)/);
    assert.match(requestDb, /ORDER BY sb\.booking_date ASC, sb\.start_time ASC, sb\.id ASC/);
    assert.match(requestDb, /participantName: role === "requester" \? providerName : requesterName/);
    assert.match(homepage, /export const dynamic = "force-dynamic"/);
    assert.match(homepage, /getNextUpcomingVisitForUser\(session\.user\.id\)/);
    assert.match(upcomingVisitCard, /visit\?\.endsAt/);
    assert.match(upcomingVisitCard, /window\.setTimeout/);
    assert.match(upcomingVisitCard, /router\.refresh\(\)/);
  });
});
