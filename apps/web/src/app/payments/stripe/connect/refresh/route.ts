import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth";
import { createProviderStripeAccountLink } from "../../../db";
import { ensureDraftProviderProfile } from "../../../../provider/db";
import { getStripeConnectSetupStatus, type StripeConnectSetupStatus } from "../../../stripe-errors";

type ConnectRefreshDestination = "account" | "provider";

function getDestination(value: string | null): ConnectRefreshDestination {
  return value === "provider" ? "provider" : "account";
}

function getDestinationErrorPath(
  destination: ConnectRefreshDestination,
  status: StripeConnectSetupStatus,
) {
  if (destination === "provider") {
    return `/provider?stripe=${status}`;
  }

  return `/account/payments?stripe=${status}`;
}

function getDestinationConfig(destination: ConnectRefreshDestination) {
  if (destination === "provider") {
    return {
      returnPath: "/provider?stripe=returned",
      refreshPath: "/payments/stripe/connect/refresh?destination=provider",
    };
  }

  return {
    returnPath: "/account/payments?stripe=returned",
    refreshPath: "/payments/stripe/connect/refresh?destination=account",
  };
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const destination = getDestination(requestUrl.searchParams.get("destination"));
  const config = getDestinationConfig(destination);
  const user = await requireUser();

  try {
    await ensureDraftProviderProfile(user.id, user.name);
    const onboardingUrl = await createProviderStripeAccountLink(user.id, {
      baseUrl: requestUrl.origin,
      returnPath: config.returnPath,
      refreshPath: config.refreshPath,
    });

    return NextResponse.redirect(onboardingUrl);
  } catch (error) {
    console.error("Failed to refresh Stripe provider onboarding link", error);
    const errorPath = getDestinationErrorPath(destination, getStripeConnectSetupStatus(error));
    return NextResponse.redirect(new URL(errorPath, requestUrl.origin));
  }
}
