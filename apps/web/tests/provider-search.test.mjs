import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterProviderSearchResults } from "../src/app/providers/search.js";

const sanFrancisco = { latitude: 37.7749, longitude: -122.4194 };

function provider(overrides = {}) {
  return {
    id: 1,
    status: "active",
    latitude: 37.7749,
    longitude: -122.4194,
    serviceRadiusMiles: 10,
    services: [{ serviceType: "companionship" }],
    ...overrides,
  };
}

describe("provider search filtering", () => {
  it("shows active providers only", () => {
    const results = filterProviderSearchResults([
      provider({ id: 1, status: "active" }),
      provider({ id: 2, status: "draft" }),
      provider({ id: 3, status: "paused" }),
    ], {});

    assert.deepEqual(results.map((item) => item.id), [1]);
  });

  it("filters by service", () => {
    const results = filterProviderSearchResults([
      provider({ id: 1, services: [{ serviceType: "companionship" }] }),
      provider({ id: 2, services: [{ serviceType: "music-lessons" }] }),
    ], { service: "music-lessons" });

    assert.deepEqual(results.map((item) => item.id), [2]);
  });

  it("includes providers whose service radius covers the search ZIP location", () => {
    const results = filterProviderSearchResults([
      provider({ id: 1, serviceRadiusMiles: 5 }),
      provider({ id: 2, latitude: 37.3382, longitude: -121.8863, serviceRadiusMiles: 5 }),
      provider({ id: 3, latitude: null, longitude: null, serviceRadiusMiles: 50 }),
    ], { location: sanFrancisco });

    assert.deepEqual(results.map((item) => item.id), [1]);
  });
});

