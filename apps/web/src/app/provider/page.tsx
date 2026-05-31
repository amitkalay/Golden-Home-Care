import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../lib/auth";
import { getUnreadMessageThreadCount } from "../messages/db";
import { getUnreadNotificationCount } from "../notifications/db";
import { refreshProviderStripeAccountForUser } from "../payments/db";
import { ensureDraftProviderProfile, getProviderProfileByUserId } from "./db";
import { ProviderDashboardCards, ProviderShell } from "./ui";

export const dynamic = "force-dynamic";

type ProviderPageProps = {
  searchParams?: Promise<{
    profile?: string | string[];
    stripe?: string | string[];
  }>;
};

function getParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProviderPage({ searchParams }: ProviderPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  await ensureDraftProviderProfile(session.user.id, session.user.name);
  const params = searchParams ? await searchParams : {};
  const stripeStatus = getParam(params.stripe);

  if (stripeStatus === "returned" || stripeStatus === "refresh") {
    try {
      await refreshProviderStripeAccountForUser(session.user.id);
    } catch (error) {
      console.error("Failed to refresh Stripe provider status", error);
    }
  }

  const [profile, notificationCount, messageCount] = await Promise.all([
    getProviderProfileByUserId(session.user.id),
    getUnreadNotificationCount(session.user.id),
    getUnreadMessageThreadCount(session.user.id),
  ]);
  const profileStatus = getParam(params.profile);

  return (
    <ProviderShell
      title="Provider dashboard"
      copy="Manage your profile, availability, and public marketplace presence."
      notificationCount={notificationCount}
      messageCount={messageCount}
    >
      {profileStatus === "active" ? (
        <p className="form-alert success" role="status">
          Your provider profile is active and eligible for search.
        </p>
      ) : null}
      {stripeStatus === "returned" ? (
        <p className="form-alert success" role="status">
          Stripe test payment setup has been refreshed.
        </p>
      ) : null}
      {stripeStatus === "refresh" || stripeStatus === "error" ? (
        <p className="form-alert error" role="alert">
          Stripe setup needs another attempt before payments can be accepted.
        </p>
      ) : null}
      {stripeStatus === "connect-disabled" ? (
        <p className="form-alert error" role="alert">
          Stripe Connect is not enabled for this Stripe test account. Enable Connect in Stripe, then start setup again.
        </p>
      ) : null}
      {stripeStatus === "config" || stripeStatus === "setup-error" ? (
        <p className="form-alert error" role="alert">
          Stripe setup could not start. Check the test payment configuration and try again.
        </p>
      ) : null}
      <ProviderDashboardCards profile={profile} />
    </ProviderShell>
  );
}
