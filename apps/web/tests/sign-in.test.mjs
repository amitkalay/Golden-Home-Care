import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("provider sign in", () => {
  it("supports email/password sign in and Google OAuth with a safe callback URL", async () => {
    const signInPage = await readFile(
      new URL("../src/app/sign-in/page.tsx", import.meta.url),
      "utf8",
    );
    const emailForm = await readFile(
      new URL("../src/app/sign-in/email-sign-in-form.tsx", import.meta.url),
      "utf8",
    );
    const googleButton = await readFile(
      new URL("../src/app/sign-in/google-sign-in-button.tsx", import.meta.url),
      "utf8",
    );
    const authUrl = await readFile(
      new URL("../src/app/lib/auth-url.ts", import.meta.url),
      "utf8",
    );
    const providerActions = await readFile(
      new URL("../src/app/provider/actions.ts", import.meta.url),
      "utf8",
    );

    assert.match(emailForm, /"use client"/);
    assert.match(emailForm, /signIn\("credentials"/);
    assert.match(emailForm, /redirect: false/);
    assert.match(emailForm, /autoComplete="email"/);
    assert.match(emailForm, /autoComplete="current-password"/);
    assert.match(googleButton, /"use client"/);
    assert.match(googleButton, /callbackUrl = "\/"/);
    assert.match(googleButton, /signIn\("google", \{ callbackUrl \}\)/);
    assert.match(authUrl, /function normalizeCallbackUrl/);
    assert.match(authUrl, /callbackUrl\.startsWith\("\/\/"\)/);
    assert.match(authUrl, /callbackUrl === "\/provider" \? "\/" : callbackUrl/);
    assert.match(signInPage, /const callbackUrl = normalizeCallbackUrl\(callbackUrlParam\)/);
    assert.match(signInPage, /Create an account/);
    assert.match(signInPage, /Forgot password\?/);
    assert.match(signInPage, /Google sign-in requires a verified Google email address/);
    assert.equal(providerActions.includes("/api/auth/signin/google?callbackUrl=/provider/onboarding"), false);
    assert.match(authUrl, /callbackUrl === "\/provider"/);
    assert.equal(signInPage.includes('callbackUrl === "/provider/onboarding"'), false);
  });
});
