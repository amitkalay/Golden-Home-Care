import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("password auth source checks", () => {
  it("registers credentials auth and verified Google same-email linking", async () => {
    const auth = await readFile(new URL("../src/app/lib/auth.ts", import.meta.url), "utf8");

    assert.match(auth, /CredentialsProvider/);
    assert.match(auth, /authenticatePasswordUser\(credentials\?\.email, credentials\?\.password\)/);
    assert.match(auth, /allowDangerousEmailAccountLinking: true/);
    assert.match(auth, /email: normalizeEmail\(profile\.email\)/);
    assert.match(auth, /googleProfile\.email_verified === true/);
    assert.match(auth, /markGoogleEmailVerified/);
  });

  it("creates password and token tables through the auth bootstrap", async () => {
    const database = await readFile(new URL("../src/app/lib/database.ts", import.meta.url), "utf8");

    assert.match(database, /CREATE TABLE IF NOT EXISTS user_passwords/);
    assert.match(database, /password_hash text not null/);
    assert.match(database, /CREATE TABLE IF NOT EXISTS pending_password_signups/);
    assert.match(database, /verification_token_hash text not null unique/);
    assert.match(database, /CREATE TABLE IF NOT EXISTS password_reset_tokens/);
    assert.match(database, /token_hash text not null unique/);
  });

  it("keeps Google-only accounts from receiving password credentials", async () => {
    const passwordAccounts = await readFile(new URL("../src/app/lib/password-accounts.ts", import.meta.url), "utf8");

    assert.match(passwordAccounts, /if \(existingUser\) \{/);
    assert.match(passwordAccounts, /sendExistingAccountEmail\(existingUser\)/);
    assert.match(passwordAccounts, /if \(!existingUser\.hasPassword\) \{/);
    assert.match(passwordAccounts, /sendGoogleOnlyResetEmail\(existingUser\.email\)/);
    assert.match(passwordAccounts, /INSERT INTO pending_password_signups/);
    assert.match(passwordAccounts, /ON CONFLICT \(email\) DO UPDATE/);
    assert.match(passwordAccounts, /UPDATE user_passwords/);
  });

  it("adds signup, verification, forgot, and reset password screens", async () => {
    const signUpPage = await readFile(new URL("../src/app/sign-up/page.tsx", import.meta.url), "utf8");
    const forgotPage = await readFile(new URL("../src/app/forgot-password/page.tsx", import.meta.url), "utf8");
    const resetPage = await readFile(new URL("../src/app/reset-password/page.tsx", import.meta.url), "utf8");
    const verifyPage = await readFile(new URL("../src/app/verify-email/page.tsx", import.meta.url), "utf8");

    assert.match(signUpPage, /requestPasswordSignupAction/);
    assert.match(signUpPage, /autoComplete="new-password"/);
    assert.match(signUpPage, /minLength=\{8\}/);
    assert.match(forgotPage, /If that email can sign in/);
    assert.match(resetPage, /isPasswordResetTokenValid\(token\)/);
    assert.match(resetPage, /name="token" type="hidden"/);
    assert.match(verifyPage, /verifyPendingPasswordSignup\(token\)/);
    assert.match(verifyPage, /Continue with Google/);
  });
});
