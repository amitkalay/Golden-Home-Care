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
    helpNeeded: ["companionship", "meal-prep"],
    helpNeededOther: "",
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
  it("normalizes and accepts a valid lead with preset help selections", () => {
    const result = parseFamilyLeadForm(validForm());

    assert.equal(result.ok, true);
    assert.equal(result.data.email, "jane@example.com");
    assert.deepEqual(result.data.helpNeeded, ["companionship", "meal-prep"]);
  });

  it("accepts leads without a phone number", () => {
    const result = parseFamilyLeadForm(validForm({ phone: "" }));

    assert.equal(result.ok, true);
    assert.equal(result.errors.phone, undefined);
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

  it("accepts custom help needed text without a checked box", () => {
    const result = parseFamilyLeadForm(validForm({ helpNeeded: [], helpNeededOther: "Light gardening" }));

    assert.equal(result.ok, true);
    assert.deepEqual(result.data.helpNeeded, ["Light gardening"]);
    assert.equal(result.data.helpNeededOther, "Light gardening");
  });

  it("records preset and custom help needed values together", () => {
    const result = parseFamilyLeadForm(validForm({ helpNeeded: ["walks"], helpNeededOther: "Light housekeeping" }));

    assert.equal(result.ok, true);
    assert.deepEqual(result.data.helpNeeded, ["walks", "Light housekeeping"]);
    assert.equal(result.data.helpNeededOther, "Light housekeeping");
  });

  it("rejects a blank custom help checkbox without preset selections", () => {
    const result = parseFamilyLeadForm(
      validForm({ helpNeeded: [], helpNeededOther: "", helpNeededOtherSelected: "true" }),
    );

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
