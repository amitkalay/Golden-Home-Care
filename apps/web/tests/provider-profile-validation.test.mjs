import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateAvailabilitySummary,
  parseProviderAvailabilityForm,
  parseProviderProfileForm,
  validateProviderPhoto,
} from "../src/app/provider/profile-validation.js";

function validForm(overrides = {}) {
  const form = new FormData();
  const values = {
    displayName: "Sam Provider",
    email: "SAM@EXAMPLE.COM",
    phone: "(555) 222-3333",
    zipCode: "94107",
    serviceRadiusMiles: "12",
    hourlyRate: "35",
    servicesOffered: ["meal-prep", "walks"],
    bio: "Warm companion with local references.",
    experienceSummary: "Three years supporting older adults.",
    languages: "English, Spanish, English",
    transportationAvailable: "yes",
    backgroundCheckWilling: "yes",
    ...overrides,
  };

  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      for (const item of value) form.append(key, item);
    } else {
      form.set(key, value);
    }
  }

  return form;
}

function validAvailabilityForm(overrides = {}) {
  const form = new FormData();
  const values = {
    availableDays: ["3", "1"],
    "startTime-1": "09:00",
    "endTime-1": "12:00",
    "startTime-3": "14:00",
    "endTime-3": "17:30",
    availabilityTimezone: "America/Los_Angeles",
    minimumNoticeMinutes: "120",
    onDemandAvailable: "yes",
    ...overrides,
  };

  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      for (const item of value) form.append(key, item);
    } else {
      form.set(key, value);
    }
  }

  return form;
}

describe("provider profile validation", () => {
  it("normalizes and accepts a complete profile", () => {
    const result = parseProviderProfileForm(validForm());

    assert.equal(result.ok, true);
    assert.equal(result.data.email, "sam@example.com");
    assert.equal(result.data.hourlyRateCents, 3500);
    assert.deepEqual(result.data.servicesOffered, ["meal-prep", "walks"]);
    assert.deepEqual(result.data.languages, ["English", "Spanish"]);
    assert.equal(result.data.transportationAvailable, true);
    assert.equal(result.data.backgroundCheckWilling, true);
  });

  it("rejects required field omissions and invalid ZIP codes", () => {
    const result = parseProviderProfileForm(validForm({ displayName: "", zipCode: "9410", availabilitySummary: "" }));

    assert.equal(result.ok, false);
    assert.equal(result.errors.displayName, "Required");
    assert.equal(result.errors.zipCode, "Enter a valid 5-digit ZIP code");
    assert.equal(result.errors.availabilitySummary, undefined);
  });

  it("rejects invalid rates, service radius, and services", () => {
    const result = parseProviderProfileForm(
      validForm({
        hourlyRate: "35.50",
        serviceRadiusMiles: "200",
        servicesOffered: ["arts-and-crafts"],
      }),
    );

    assert.equal(result.ok, false);
    assert.equal(result.errors.hourlyRate, "Enter a whole-number hourly rate from 1 to 250");
    assert.equal(result.errors.serviceRadiusMiles, "Enter a service radius from 1 to 100 miles");
    assert.equal(result.errors.servicesOffered, "Select at least one service");
  });

  it("validates photo file type and size", () => {
    assert.equal(validateProviderPhoto(new File(["x"], "photo.jpg", { type: "image/jpeg" })).ok, true);

    const badType = validateProviderPhoto(new File(["x"], "photo.gif", { type: "image/gif" }));
    assert.equal(badType.ok, false);
    assert.equal(badType.error, "Upload a JPEG, PNG, or WebP image");

    const tooLarge = validateProviderPhoto(
      new File([new Uint8Array(4 * 1024 * 1024 + 1)], "photo.jpg", { type: "image/jpeg" }),
    );
    assert.equal(tooLarge.ok, false);
    assert.equal(tooLarge.error, "Photo must be 4 MB or smaller");
  });

  it("normalizes weekly availability windows", () => {
    const result = parseProviderAvailabilityForm(validAvailabilityForm());

    assert.equal(result.ok, true);
    assert.deepEqual(result.data.windows, [
      { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" },
      { dayOfWeek: 3, startTime: "14:00", endTime: "17:30" },
    ]);
    assert.equal(result.data.availabilityTimezone, "America/Los_Angeles");
    assert.equal(result.data.onDemandAvailable, true);
    assert.equal(result.data.minimumNoticeMinutes, 120);
    assert.equal(
      result.data.availabilitySummary,
      "Mon 9:00 AM-12:00 PM; Wed 2:00 PM-5:30 PM Pacific time. On-demand requests accepted with 2 hours notice.",
    );
  });

  it("rejects missing days, invalid times, and unsupported minimum notice", () => {
    const noDays = parseProviderAvailabilityForm(validAvailabilityForm({ availableDays: [] }));
    assert.equal(noDays.ok, false);
    assert.equal(noDays.errors.availableDays, "Select at least one available day");

    const invalidTimes = parseProviderAvailabilityForm(validAvailabilityForm({ "startTime-1": "9am" }));
    assert.equal(invalidTimes.ok, false);
    assert.equal(invalidTimes.errors.availabilityWindows, "Enter valid start and end times for each selected day");

    const endBeforeStart = parseProviderAvailabilityForm(
      validAvailabilityForm({ "startTime-1": "13:00", "endTime-1": "12:00" }),
    );
    assert.equal(endBeforeStart.ok, false);
    assert.equal(endBeforeStart.errors.availabilityWindows, "End time must be after start time");

    const unsupportedNotice = parseProviderAvailabilityForm(validAvailabilityForm({ minimumNoticeMinutes: "90" }));
    assert.equal(unsupportedNotice.ok, false);
    assert.equal(unsupportedNotice.errors.minimumNoticeMinutes, "Select a supported minimum notice");
  });

  it("generates and falls back for availability summaries", () => {
    const summary = generateAvailabilitySummary({
      windows: [{ dayOfWeek: 5, startTime: "08:30", endTime: "11:00" }],
      timezone: "America/New_York",
      onDemandAvailable: true,
      minimumNoticeMinutes: 60,
    });

    assert.equal(summary, "Fri 8:30 AM-11:00 AM Eastern time. On-demand requests accepted with 1 hour notice.");
    assert.equal(
      generateAvailabilitySummary({ windows: [], fallbackSummary: "Weekday mornings." }),
      "Weekday mornings.",
    );
  });
});
