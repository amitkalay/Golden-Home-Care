"use server";

import { redirect } from "next/navigation";
import { resetPasswordWithToken } from "../lib/password-accounts";
import { parseResetPasswordForm } from "../lib/password-security.js";

function buildResetHref(token: string, status: string) {
  const params = new URLSearchParams({ status });

  if (token) {
    params.set("token", token);
  }

  return `/reset-password?${params.toString()}`;
}

export async function resetPasswordAction(formData: FormData) {
  const result = parseResetPasswordForm(formData);

  if (!result.ok) {
    redirect(buildResetHref(result.data.token, "invalid"));
  }

  let resetResult;

  try {
    resetResult = await resetPasswordWithToken(result.data.token, result.data.password);
  } catch (error) {
    console.error("Failed to reset password", error);
    redirect(buildResetHref(result.data.token, "error"));
  }

  if (resetResult !== "reset") {
    redirect(buildResetHref("", resetResult));
  }

  redirect("/sign-in?status=password-reset");
}
