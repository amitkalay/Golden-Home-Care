import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseAccountProfileForm,
  validateAccountPhoto,
} from "../src/app/account/profile-validation.js";

function accountForm(overrides = {}) {
  const form = new FormData();
  const values = {
    name: "Avery Account",
    bio: "Family coordinator for care visits.",
    ...overrides,
  };

  for (const [key, value] of Object.entries(values)) {
    form.set(key, value);
  }

  return form;
}

describe("account profile validation", () => {
  it("accepts and trims a valid account profile", () => {
    const result = parseAccountProfileForm(accountForm({ name: "  Avery Account  " }));

    assert.equal(result.ok, true);
    assert.equal(result.data.name, "Avery Account");
    assert.equal(result.data.bio, "Family coordinator for care visits.");
  });

  it("rejects empty names and overlong bios", () => {
    const result = parseAccountProfileForm(accountForm({ name: "", bio: "x".repeat(501) }));

    assert.equal(result.ok, false);
    assert.equal(result.errors.name, "Required");
    assert.equal(result.errors.bio, "Too long");
  });

  it("validates account photo file type and size", () => {
    assert.equal(validateAccountPhoto(new File(["x"], "photo.webp", { type: "image/webp" })).ok, true);

    const badType = validateAccountPhoto(new File(["x"], "photo.gif", { type: "image/gif" }));
    assert.equal(badType.ok, false);
    assert.equal(badType.error, "Upload a JPEG, PNG, or WebP image");

    const tooLarge = validateAccountPhoto(
      new File([new Uint8Array(4 * 1024 * 1024 + 1)], "photo.png", { type: "image/png" }),
    );
    assert.equal(tooLarge.ok, false);
    assert.equal(tooLarge.error, "Photo must be 4 MB or smaller");
  });
});
