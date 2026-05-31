export type StripeConnectSetupStatus = "config" | "connect-disabled" | "setup-error";

export function getStripeConnectSetupStatus(error: unknown): StripeConnectSetupStatus {
  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("STRIPE_SECRET_KEY") ||
    message.includes("APP_BASE_URL") ||
    message.includes("DATABASE_URL")
  ) {
    return "config";
  }

  if (
    message.includes("signed up for Connect") ||
    message.includes("dashboard.stripe.com/connect")
  ) {
    return "connect-disabled";
  }

  return "setup-error";
}
