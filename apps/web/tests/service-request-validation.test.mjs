import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getTodayDateString,
  parseServiceRequestForm,
} from "../src/app/requests/validation.js";

function validRequestForm(overrides = {}) {
  const form = new FormData();
  const values = {
    matchPreference: "specific",
    providerProfileId: "42",
    serviceType: "meal-prep",
    zipCode: "94107",
    requestedDate: "2026-05-21",
    windowStartTime: "09:00",
    windowEndTime: "12:00",
    durationMinutes: "60",
    urgency: "soon",
    contactName: "Rita Requester",
    contactEmail: "RITA@EXAMPLE.COM",
    contactPhone: "(555) 111-2222",
    notes: "Please bring simple recipes.",
    ...overrides,
  };

  for (const [key, value] of Object.entries(values)) {
    form.set(key, value);
  }

  return form;
}

describe("service request validation", () => {
  it("normalizes and accepts a complete request", () => {
    const result = parseServiceRequestForm(validRequestForm(), { today: "2026-05-20" });

    assert.equal(result.ok, true);
    assert.equal(result.data.matchPreference, "specific");
    assert.equal(result.data.providerProfileId, 42);
    assert.equal(result.data.contactEmail, "rita@example.com");
    assert.equal(result.data.durationMinutes, 60);
  });

  it("allows any matching provider without a provider id", () => {
    const result = parseServiceRequestForm(
      validRequestForm({ matchPreference: "any", providerProfileId: "" }),
      { today: "2026-05-20" },
    );

    assert.equal(result.ok, true);
    assert.equal(result.data.providerProfileId, null);
  });

  it("rejects invalid service, ZIP, contact fields, urgency, and notes length", () => {
    const result = parseServiceRequestForm(
      validRequestForm({
        serviceType: "gardening",
        zipCode: "9410",
        urgency: "whenever",
        contactName: "",
        contactEmail: "bad-email",
        contactPhone: "12",
        notes: "x".repeat(1001),
      }),
      { today: "2026-05-20" },
    );

    assert.equal(result.ok, false);
    assert.equal(result.errors.serviceType, "Select a service");
    assert.equal(result.errors.zipCode, "Enter a valid 5-digit ZIP code");
    assert.equal(result.errors.urgency, "Select urgency");
    assert.equal(result.errors.contactName, "Required");
    assert.equal(result.errors.contactEmail, "Enter a valid email");
    assert.equal(result.errors.contactPhone, "Enter a valid phone number");
    assert.equal(result.errors.notes, "Too long");
  });

  it("rejects invalid dates, time windows, and durations", () => {
    const pastDate = parseServiceRequestForm(
      validRequestForm({ requestedDate: "2026-05-19" }),
      { today: "2026-05-20" },
    );
    assert.equal(pastDate.ok, false);
    assert.equal(pastDate.errors.requestedDate, "Choose today or a future date");

    const invalidTime = parseServiceRequestForm(
      validRequestForm({ windowStartTime: "9am" }),
      { today: "2026-05-20" },
    );
    assert.equal(invalidTime.ok, false);
    assert.equal(invalidTime.errors.timeWindow, "Enter a valid start and end time");

    const endBeforeStart = parseServiceRequestForm(
      validRequestForm({ windowStartTime: "13:00", windowEndTime: "12:00" }),
      { today: "2026-05-20" },
    );
    assert.equal(endBeforeStart.ok, false);
    assert.equal(endBeforeStart.errors.timeWindow, "End time must be after start time");

    const unsupportedDuration = parseServiceRequestForm(
      validRequestForm({ durationMinutes: "45" }),
      { today: "2026-05-20" },
    );
    assert.equal(unsupportedDuration.ok, false);
    assert.equal(unsupportedDuration.errors.durationMinutes, "Select a supported duration");

    const tooLong = parseServiceRequestForm(
      validRequestForm({ windowStartTime: "09:00", windowEndTime: "09:30", durationMinutes: "60" }),
      { today: "2026-05-20" },
    );
    assert.equal(tooLong.ok, false);
    assert.equal(tooLong.errors.durationMinutes, "Duration must fit within the requested time window");
  });

  it("formats today's date as an ISO date string", () => {
    assert.match(getTodayDateString(), /^\d{4}-\d{2}-\d{2}$/);
  });
});
