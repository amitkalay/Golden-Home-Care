"use server";

import { redirect } from "next/navigation";
import { buildAuthStatusHref, normalizeCallbackUrl } from "../lib/auth-url";
import { requestPasswordSignup } from "../lib/password-accounts";
import { parseSignupForm } from "../lib/password-security.js";

function getCallbackUrl(formData: FormData) {
  return normalizeCallbackUrl(String(formData.get("callbackUrl") ?? ""));
}

export async function requestPasswordSignupAction(formData: FormData) {
  const callbackUrl = getCallbackUrl(formData);
  const result = parseSignupForm(formData);

  if (!result.ok) {
    redirect(buildAuthStatusHref("/sign-up", "invalid", callbackUrl));
  }

  try {
    await requestPasswordSignup({
      name: result.data.name,
      email: result.data.email,
      password: result.data.password,
      callbackUrl,
    });
  } catch (error) {
    console.error("Failed to start password signup", error);
    redirect(buildAuthStatusHref("/sign-up", "error", callbackUrl));
  }

  redirect(buildAuthStatusHref("/sign-up", "check-email", callbackUrl));
}
