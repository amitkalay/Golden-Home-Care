import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createAuthToken,
  getResetExpiry,
  getVerificationExpiry,
  hashPassword,
  hashToken,
  isExpired,
  normalizeEmail,
  parseEmailForm,
  parseResetPasswordForm,
  parseSignupForm,
  validatePasswordFields,
  verifyPassword,
} from "../src/app/lib/password-security.js";

describe("password security helpers", () => {
  it("normalizes email and validates auth forms", () => {
    assert.equal(normalizeEmail("  User@Example.COM "), "user@example.com");
    assert.equal(parseEmailForm({ email: "bad" }).ok, false);
    assert.equal(parseEmailForm({ email: "valid@example.com" }).ok, true);

    const signup = parseSignupForm({
      name: "Amit",
      email: "AMIT@example.com",
      password: "password123",
      passwordConfirmation: "password123",
    });

    assert.equal(signup.ok, true);
    assert.equal(signup.data.email, "amit@example.com");
    assert.equal(parseSignupForm({ name: "", email: "x", password: "short", passwordConfirmation: "no" }).ok, false);
    assert.equal(parseResetPasswordForm({ token: "token", password: "password123", passwordConfirmation: "password123" }).ok, true);

    const spacedPassword = parseResetPasswordForm({
      token: "token",
      password: " password123 ",
      passwordConfirmation: " password123 ",
    });

    assert.equal(spacedPassword.ok, true);
    assert.equal(spacedPassword.data.password, " password123 ");
  });

  it("enforces password length and confirmation", () => {
    assert.equal(validatePasswordFields("1234567", "1234567").ok, false);
    assert.equal(validatePasswordFields("12345678", "87654321").ok, false);
    assert.equal(validatePasswordFields("12345678", "12345678").ok, true);
    assert.equal(validatePasswordFields("x".repeat(129), "x".repeat(129)).ok, false);
  });

  it("hashes auth tokens without storing the raw token", () => {
    const token = createAuthToken();
    const tokenHash = hashToken(token);

    assert.equal(token.length > 32, true);
    assert.equal(tokenHash.length, 64);
    assert.equal(hashToken(token), tokenHash);
    assert.notEqual(tokenHash, token);
  });

  it("hashes and verifies passwords with scrypt", async () => {
    const passwordHash = await hashPassword("password123");

    assert.match(passwordHash, /^scrypt\$N=16384,r=8,p=1\$/);
    assert.equal(await verifyPassword("password123", passwordHash), true);
    assert.equal(await verifyPassword("wrong-password", passwordHash), false);
    assert.equal(await verifyPassword("password123", "not-a-valid-hash"), false);
  });

  it("calculates verification and reset expiry windows", () => {
    const now = new Date("2026-06-10T12:00:00.000Z");

    assert.equal(getVerificationExpiry(now).toISOString(), "2026-06-11T12:00:00.000Z");
    assert.equal(getResetExpiry(now).toISOString(), "2026-06-10T13:00:00.000Z");
    assert.equal(isExpired(new Date("2026-06-10T11:59:59.000Z"), now), true);
    assert.equal(isExpired(new Date("2026-06-10T12:00:01.000Z"), now), false);
  });
});
