"use server";

import { redirect } from "next/navigation";
import { requireUser } from "../../lib/auth";
import { createProviderStripeAccountLink } from "../../payments/db";
import { getCurrentRequestBaseUrl } from "../../payments/request-url";
import { getStripeConnectSetupStatus } from "../../payments/stripe-errors";
import { ensureDraftProviderProfile } from "../../provider/db";

export async function startAccountStripeProviderOnboarding() {
  const user = await requireUser();

  let onboardingUrl: string;
  try {
    await ensureDraftProviderProfile(user.id, user.name);
    onboardingUrl = await createProviderStripeAccountLink(user.id, {
      baseUrl: await getCurrentRequestBaseUrl(),
      returnPath: "/account/payments?stripe=returned",
      refreshPath: "/payments/stripe/connect/refresh?destination=account",
    });
  } catch (error) {
    console.error("Failed to create account Stripe provider onboarding link", error);
    redirect(`/account/payments?stripe=${getStripeConnectSetupStatus(error)}`);
  }

  redirect(onboardingUrl);
}
