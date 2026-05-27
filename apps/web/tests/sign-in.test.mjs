import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("provider sign in", () => {
  it("starts Google OAuth through the NextAuth client helper with a callback URL", async () => {
    const signInPage = await readFile(
      new URL("../src/app/sign-in/page.tsx", import.meta.url),
      "utf8",
    );
    const googleButton = await readFile(
      new URL("../src/app/sign-in/google-sign-in-button.tsx", import.meta.url),
      "utf8",
    );
    const providerActions = await readFile(
      new URL("../src/app/provider/actions.ts", import.meta.url),
      "utf8",
    );

    assert.match(googleButton, /"use client"/);
    assert.match(googleButton, /callbackUrl = "\/"/);
    assert.match(googleButton, /signIn\("google", \{ callbackUrl \}\)/);
    assert.match(signInPage, /function normalizeCallbackUrl/);
    assert.match(signInPage, /callbackUrl\.startsWith\("\/\/"\)/);
    assert.match(signInPage, /callbackUrl === "\/provider" \? "\/" : callbackUrl/);
    assert.match(signInPage, /const callbackUrl = normalizeCallbackUrl\(callbackUrlParam\)/);
    assert.match(signInPage, /Google sign-in could not start/);
    assert.equal(providerActions.includes("/api/auth/signin/google?callbackUrl=/provider/onboarding"), false);
    assert.match(signInPage, /callbackUrl === "\/provider"/);
    assert.equal(signInPage.includes('callbackUrl === "/provider/onboarding"'), false);
  });
});
