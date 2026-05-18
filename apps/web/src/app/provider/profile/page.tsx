import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../../lib/auth";
import { ensureDraftProviderProfile, getProviderProfileByUserId } from "../db";
import { ProviderProfileForm, ProviderShell } from "../ui";

export const dynamic = "force-dynamic";

type ProfilePageProps = {
  searchParams?: Promise<{
    status?: string | string[];
  }>;
};

export default async function ProviderProfilePage({ searchParams }: ProfilePageProps) {
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
      title="Provider profile"
      copy="Edit the information families see when your profile appears in search."
    >
      <ProviderProfileForm profile={profile} mode="profile" status={status} />
    </ProviderShell>
  );
}
