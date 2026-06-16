import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findRequestProviderMatches } from "../src/app/requests/matching.js";

const sanFrancisco = { latitude: 37.7749, longitude: -122.4194 };

function request(overrides = {}) {
  return {
    serviceType: "medical_companion",
    location: sanFrancisco,
    requestedDate: "2026-05-21",
    windowStartTime: "09:00",
    windowEndTime: "12:00",
    durationMinutes: 60,
    targetProviderId: null,
    ...overrides,
  };
}

function provider(overrides = {}) {
  return {
    id: 1,
    status: "active",
    latitude: 37.7749,
    longitude: -122.4194,
    serviceRadiusMiles: 10,
    services: [{ serviceType: "medical_companion" }],
    availabilityWindows: [{ dayOfWeek: 4, startTime: "08:00", endTime: "13:00" }],
    bookings: [],
    onDemandAvailable: false,
    minimumNoticeMinutes: 120,
    ...overrides,
  };
}

describe("request provider matching", () => {
  it("matches only active providers that offer the service within radius", () => {
    const results = findRequestProviderMatches([
      provider({ id: 1 }),
      provider({ id: 2, status: "paused" }),
      provider({ id: 3, services: [{ serviceType: "music-lessons" }] }),
      provider({ id: 4, latitude: 37.3382, longitude: -121.8863, serviceRadiusMiles: 5 }),
    ], request());

    assert.deepEqual(results.map((item) => item.providerProfileId), [1]);
    assert.equal(results[0].matchSource, "weekly");
  });

  it("matches weekly availability with enough overlap for the requested duration", () => {
    const results = findRequestProviderMatches([
      provider({ id: 1, availabilityWindows: [{ dayOfWeek: 4, startTime: "08:30", endTime: "10:30" }] }),
      provider({ id: 2, availabilityWindows: [{ dayOfWeek: 4, startTime: "10:30", endTime: "12:00" }] }),
    ], request({ durationMinutes: 90 }));

    assert.deepEqual(results.map((item) => item.providerProfileId), [1, 2]);
  });

  it("rejects weekly availability when overlap is shorter than the duration", () => {
    const results = findRequestProviderMatches([
      provider({ id: 1, availabilityWindows: [{ dayOfWeek: 4, startTime: "08:30", endTime: "09:30" }] }),
      provider({ id: 2, availabilityWindows: [{ dayOfWeek: 5, startTime: "09:00", endTime: "12:00" }] }),
    ], request({ durationMinutes: 60 }));

    assert.deepEqual(results, []);
  });

  it("matches on-demand providers when the requested start satisfies minimum notice", () => {
    const now = new Date(2026, 4, 21, 8, 30);
    const results = findRequestProviderMatches([
      provider({
        id: 1,
        availabilityWindows: [],
        onDemandAvailable: true,
        minimumNoticeMinutes: 120,
      }),
      provider({
        id: 2,
        availabilityWindows: [],
        onDemandAvailable: true,
        minimumNoticeMinutes: 180,
      }),
    ], request({ windowStartTime: "11:00", windowEndTime: "13:00" }), { now });

    assert.deepEqual(results.map((item) => item.providerProfileId), [1]);
    assert.equal(results[0].matchSource, "on_demand");
  });

  it("limits specific-provider requests to the selected provider", () => {
    const results = findRequestProviderMatches([
      provider({ id: 1 }),
      provider({ id: 2, latitude: 37.7849, longitude: -122.4094 }),
    ], request({ targetProviderId: 2 }));

    assert.deepEqual(results.map((item) => item.providerProfileId), [2]);
  });

  it("excludes providers with overlapping confirmed or payment-pending bookings", () => {
    const results = findRequestProviderMatches([
      provider({
        id: 1,
        bookings: [
          {
            bookingDate: "2026-05-21",
            startTime: "10:00",
            endTime: "11:00",
            status: "confirmed",
          },
        ],
      }),
      provider({
        id: 2,
        bookings: [
          {
            bookingDate: "2026-05-21",
            startTime: "12:00",
            endTime: "13:00",
            status: "confirmed",
          },
        ],
      }),
      provider({
        id: 3,
        bookings: [
          {
            bookingDate: "2026-05-21",
            startTime: "10:00",
            endTime: "11:00",
            status: "payment_pending",
          },
        ],
      }),
      provider({
        id: 4,
        bookings: [
          {
            bookingDate: "2026-05-21",
            startTime: "10:00",
            endTime: "11:00",
            status: "canceled",
          },
        ],
      }),
    ], request({ windowStartTime: "09:00", windowEndTime: "12:00" }));

    assert.deepEqual(results.map((item) => item.providerProfileId), [2, 4]);
  });
});
