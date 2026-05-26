import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../../lib/auth";
import { getUnreadMessageThreadCount } from "../../messages/db";
import { getUnreadNotificationCount } from "../../notifications/db";
import { ensureDraftProviderProfile, getProviderProfileByUserId } from "../db";
import { ProviderProfileForm, ProviderShell } from "../ui";

export const dynamic = "force-dynamic";

type OnboardingPageProps = {
  searchParams?: Promise<{
    status?: string | string[];
  }>;
};

export default async function ProviderOnboardingPage({ searchParams }: OnboardingPageProps) {
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
  const status = Array.isArray(params.status) ? params.status[0] : params.status;

  return (
    <ProviderShell
      title="Provider onboarding"
      copy="Complete these details to publish your provider profile in family search."
      notificationCount={notificationCount}
      messageCount={messageCount}
    >
      <ProviderProfileForm profile={profile} mode="onboarding" status={status} />
    </ProviderShell>
  );
}
