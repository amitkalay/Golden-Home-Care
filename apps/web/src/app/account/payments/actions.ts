"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../../lib/auth";
import { createProviderStripeAccountLink } from "../../payments/db";

export async function startAccountStripeProviderOnboarding() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/sign-in");
  }

  let onboardingUrl: string;
  try {
    onboardingUrl = await createProviderStripeAccountLink(userId, {
      returnPath: "/account/payments?stripe=returned",
      refreshPath: "/account/payments?stripe=refresh",
    });
  } catch (error) {
    console.error("Failed to create account Stripe provider onboarding link", error);
    redirect("/account/payments?stripe=error");
  }

  redirect(onboardingUrl);
}
