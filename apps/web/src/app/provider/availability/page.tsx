import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../../lib/auth";
import { getUnreadNotificationCount } from "../../notifications/db";
import { ensureDraftProviderProfile, getProviderProfileByUserId } from "../db";
import { ProviderAvailabilityForm, ProviderShell } from "../ui";

export const dynamic = "force-dynamic";

type AvailabilityPageProps = {
  searchParams?: Promise<{
    status?: string | string[];
  }>;
};

export default async function ProviderAvailabilityPage({ searchParams }: AvailabilityPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  await ensureDraftProviderProfile(session.user.id, session.user.name);
  const [profile, notificationCount] = await Promise.all([
    getProviderProfileByUserId(session.user.id),
    getUnreadNotificationCount(session.user.id),
  ]);
  const params = searchParams ? await searchParams : {};
  const status = Array.isArray(params.status) ? params.status[0] : params.status;

  return (
    <ProviderShell
      title="Availability"
      copy="Set recurring weekly windows so families know when they can request your support."
      notificationCount={notificationCount}
    >
      <ProviderAvailabilityForm profile={profile} status={status} />
    </ProviderShell>
  );
}
