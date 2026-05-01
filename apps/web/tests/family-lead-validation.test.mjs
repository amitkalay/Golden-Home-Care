import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseFamilyLeadForm } from "../src/app/family-leads/validation.js";

function validForm(overrides = {}) {
  const form = new FormData();
  const values = {
    name: "Jane Smith",
    email: "JANE@EXAMPLE.COM",
    phone: "(555) 123-4567",
    zipCode: "94107",
    relationship: "Adult child",
    helpNeeded: ["companionship", "errands"],
    frequency: "Weekly",
    neededTimeline: "This week",
    notes: "Looking for a steady weekly visit.",
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

describe("family lead validation", () => {
  it("normalizes and accepts a valid lead", () => {
    const result = parseFamilyLeadForm(validForm());

    assert.equal(result.ok, true);
    assert.equal(result.data.email, "jane@example.com");
    assert.deepEqual(result.data.helpNeeded, ["companionship", "errands"]);
  });

  it("rejects missing required fields", () => {
    const result = parseFamilyLeadForm(validForm({ name: "" }));

    assert.equal(result.ok, false);
    assert.equal(result.errors.name, "Required");
  });

  it("rejects invalid email", () => {
    const result = parseFamilyLeadForm(validForm({ email: "not-an-email" }));

    assert.equal(result.ok, false);
    assert.equal(result.errors.email, "Enter a valid email");
  });

  it("rejects submissions without selected help", () => {
    const result = parseFamilyLeadForm(validForm({ helpNeeded: [] }));

    assert.equal(result.ok, false);
    assert.equal(result.errors.helpNeeded, "Select at least one option");
  });

  it("rejects oversized notes", () => {
    const result = parseFamilyLeadForm(validForm({ notes: "x".repeat(1001) }));

    assert.equal(result.ok, false);
    assert.equal(result.errors.notes, "Too long");
  });

  it("flags honeypot submissions without exposing a validation error", () => {
    const result = parseFamilyLeadForm(validForm({ companyWebsite: "https://spam.example" }));

    assert.equal(result.ok, true);
    assert.equal(result.spam, true);
    assert.equal(result.data, null);
  });
});
