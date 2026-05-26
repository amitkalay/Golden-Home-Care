import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../lib/auth";
import { getUnreadMessageThreadCount } from "../messages/db";
import { getUnreadNotificationCount } from "../notifications/db";
import { ensureDraftProviderProfile, getProviderProfileByUserId } from "./db";
import { ProviderDashboardCards, ProviderShell } from "./ui";

export const dynamic = "force-dynamic";

type ProviderPageProps = {
  searchParams?: Promise<{
    profile?: string | string[];
  }>;
};

export default async function ProviderPage({ searchParams }: ProviderPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  await ensureDraftProviderProfile(session.user.id, session.user.name);
  const [profile, notificationCount, messageCount] = await Promise.all([
    getProviderProfileByUserId(session.user.id),
    getUnreadNotificationCount(session.user.id),
    getUnreadMessageThreadCount(session.user.id),
  ]);
  const params = searchParams ? await searchParams : {};
  const profileStatus = Array.isArray(params.profile) ? params.profile[0] : params.profile;

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
      <ProviderDashboardCards profile={profile} />
    </ProviderShell>
  );
}
