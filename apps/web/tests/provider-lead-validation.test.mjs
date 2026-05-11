import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseServiceProviderLeadForm } from "../src/app/provider-leads/validation.js";

function validForm(overrides = {}) {
  const form = new FormData();
  const values = {
    name: "Sam Provider",
    email: "SAM@EXAMPLE.COM",
    phone: "(555) 222-3333",
    serviceArea: "94107",
    hourlyRate: "32",
    servicesOffered: ["meal-prep", "companionship"],
    servicesOfferedOther: "",
    seniorCareExperience: "1-2 years",
    availability: "Weekdays",
    backgroundCheckWilling: "yes",
    notes: "Available most mornings.",
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

describe("service provider lead validation", () => {
  it("normalizes and accepts a valid provider lead", () => {
    const result = parseServiceProviderLeadForm(validForm());

    assert.equal(result.ok, true);
    assert.equal(result.data.email, "sam@example.com");
    assert.deepEqual(result.data.servicesOffered, ["meal-prep", "companionship"]);
    assert.equal(result.data.backgroundCheckWilling, true);
  });

  it("accepts provider leads without a phone number", () => {
    const result = parseServiceProviderLeadForm(validForm({ phone: "" }));

    assert.equal(result.ok, true);
    assert.equal(result.errors.phone, undefined);
  });

  it("rejects invalid email", () => {
    const result = parseServiceProviderLeadForm(validForm({ email: "not-an-email" }));

    assert.equal(result.ok, false);
    assert.equal(result.errors.email, "Enter a valid email");
  });

  it("rejects non-numeric hourly rates", () => {
    const result = parseServiceProviderLeadForm(validForm({ hourlyRate: "thirty two" }));

    assert.equal(result.ok, false);
    assert.equal(result.errors.hourlyRate, "Enter a whole-number hourly rate");
  });

  it("rejects decimal hourly rates", () => {
    const result = parseServiceProviderLeadForm(validForm({ hourlyRate: "32.50" }));

    assert.equal(result.ok, false);
    assert.equal(result.errors.hourlyRate, "Enter a whole-number hourly rate");
  });

  it("rejects currency-formatted hourly rates", () => {
    const result = parseServiceProviderLeadForm(validForm({ hourlyRate: "$32" }));

    assert.equal(result.ok, false);
    assert.equal(result.errors.hourlyRate, "Enter a whole-number hourly rate");
  });

  it("rejects missing required fields", () => {
    const result = parseServiceProviderLeadForm(validForm({ serviceArea: "" }));

    assert.equal(result.ok, false);
    assert.equal(result.errors.serviceArea, "Required");
  });

  it("rejects submissions without selected or custom services", () => {
    const result = parseServiceProviderLeadForm(validForm({ servicesOffered: [] }));

    assert.equal(result.ok, false);
    assert.equal(result.errors.servicesOffered, "Select at least one service");
  });

  it("records preset and custom services together", () => {
    const result = parseServiceProviderLeadForm(
      validForm({ servicesOffered: ["walks"], servicesOfferedOther: "Pet care" }),
    );

    assert.equal(result.ok, true);
    assert.deepEqual(result.data.servicesOffered, ["walks", "Pet care"]);
    assert.equal(result.data.servicesOfferedOther, "Pet care");
  });

  it("accepts custom services without a checked preset service", () => {
    const result = parseServiceProviderLeadForm(validForm({ servicesOffered: [], servicesOfferedOther: "Light cleaning" }));

    assert.equal(result.ok, true);
    assert.deepEqual(result.data.servicesOffered, ["Light cleaning"]);
  });

  it("rejects invalid background-check values", () => {
    const result = parseServiceProviderLeadForm(validForm({ backgroundCheckWilling: "maybe" }));

    assert.equal(result.ok, false);
    assert.equal(result.errors.backgroundCheckWilling, "Required");
  });

  it("flags honeypot submissions without exposing a validation error", () => {
    const result = parseServiceProviderLeadForm(validForm({ providerCompanyWebsite: "https://spam.example" }));

    assert.equal(result.ok, true);
    assert.equal(result.spam, true);
    assert.equal(result.data, null);
  });
});
