import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../../lib/auth";
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
  const profile = await getProviderProfileByUserId(session.user.id);
  const params = searchParams ? await searchParams : {};
  const status = Array.isArray(params.status) ? params.status[0] : params.status;

  return (
    <ProviderShell
      title="Availability"
      copy="Keep a simple summary of when families can request your support."
    >
      <ProviderAvailabilityForm profile={profile} status={status} />
    </ProviderShell>
  );
}
