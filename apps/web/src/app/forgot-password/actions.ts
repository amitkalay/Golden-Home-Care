"use server";

import { redirect } from "next/navigation";
import { requestPasswordReset } from "../lib/password-accounts";
import { parseEmailForm } from "../lib/password-security.js";

export async function requestPasswordResetAction(formData: FormData) {
  const result = parseEmailForm(formData);

  if (!result.ok) {
    redirect("/forgot-password?status=invalid");
  }

  try {
    await requestPasswordReset(result.data.email);
  } catch (error) {
    console.error("Failed to start password reset", error);
    redirect("/forgot-password?status=error");
  }

  redirect("/forgot-password?status=sent");
}
