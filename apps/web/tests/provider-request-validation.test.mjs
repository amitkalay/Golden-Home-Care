import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseProviderRequestProposalForm } from "../src/app/provider/request-validation.js";

function proposalForm(overrides = {}) {
  const form = new FormData();
  const values = {
    matchId: "42",
    proposedDate: "2026-05-22",
    proposedStartTime: "10:00",
    proposedEndTime: "11:00",
    providerResponseNote: "I can come one hour later.",
    ...overrides,
  };

  for (const [key, value] of Object.entries(values)) {
    form.set(key, value);
  }

  return form;
}

describe("provider request proposal validation", () => {
  it("accepts a valid structured proposal", () => {
    const result = parseProviderRequestProposalForm(proposalForm(), { today: "2026-05-21" });

    assert.equal(result.ok, true);
    assert.equal(result.data.matchId, 42);
    assert.equal(result.data.proposedDate, "2026-05-22");
    assert.equal(result.data.proposedStartTime, "10:00");
    assert.equal(result.data.proposedEndTime, "11:00");
  });

  it("rejects invalid match, date, and time values", () => {
    const result = parseProviderRequestProposalForm(
      proposalForm({
        matchId: "abc",
        proposedDate: "2026-02-31",
        proposedStartTime: "10am",
      }),
      { today: "2026-05-21" },
    );

    assert.equal(result.ok, false);
    assert.equal(result.errors.matchId, "Select a request");
    assert.equal(result.errors.proposedDate, "Enter a valid date");
    assert.equal(result.errors.proposedTime, "Enter valid start and end times");
  });

  it("rejects past dates", () => {
    const result = parseProviderRequestProposalForm(
      proposalForm({ proposedDate: "2026-05-20" }),
      { today: "2026-05-21" },
    );

    assert.equal(result.ok, false);
    assert.equal(result.errors.proposedDate, "Choose today or a future date");
  });

  it("rejects an end time before the start time", () => {
    const result = parseProviderRequestProposalForm(
      proposalForm({ proposedStartTime: "13:00", proposedEndTime: "12:00" }),
      { today: "2026-05-21" },
    );

    assert.equal(result.ok, false);
    assert.equal(result.errors.proposedTime, "End time must be after start time");
  });

  it("rejects proposal windows shorter than 30 minutes", () => {
    const result = parseProviderRequestProposalForm(
      proposalForm({ proposedStartTime: "10:00", proposedEndTime: "10:15" }),
      { today: "2026-05-21" },
    );

    assert.equal(result.ok, false);
    assert.equal(result.errors.proposedTime, "Proposed window must be at least 30 minutes");
  });

  it("rejects overlong response notes", () => {
    const result = parseProviderRequestProposalForm(
      proposalForm({ providerResponseNote: "x".repeat(501) }),
      { today: "2026-05-21" },
    );

    assert.equal(result.ok, false);
    assert.equal(result.errors.providerResponseNote, "Too long");
  });
});
