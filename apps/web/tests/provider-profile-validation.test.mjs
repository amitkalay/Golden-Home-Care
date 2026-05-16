import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
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
    availabilitySummary: "Weekday mornings and Sunday afternoons.",
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
    const result = parseProviderProfileForm(validForm({ displayName: "", zipCode: "9410" }));

    assert.equal(result.ok, false);
    assert.equal(result.errors.displayName, "Required");
    assert.equal(result.errors.zipCode, "Enter a valid 5-digit ZIP code");
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

  it("validates the simple availability form", () => {
    const result = parseProviderAvailabilityForm(
      new FormData(),
    );

    assert.equal(result.ok, false);
    assert.equal(result.errors.availabilitySummary, "Required");
  });
});

