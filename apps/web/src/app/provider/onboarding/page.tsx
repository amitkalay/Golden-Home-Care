import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../../lib/auth";
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

  await ensureDraftProviderProfile(session.user.id, session.user.name, session.user.image);
  const profile = await getProviderProfileByUserId(session.user.id);
  const params = searchParams ? await searchParams : {};
  const status = Array.isArray(params.status) ? params.status[0] : params.status;

  return (
    <ProviderShell
      title="Provider onboarding"
      copy="Complete these details to publish your provider profile in family search."
    >
      <ProviderProfileForm profile={profile} mode="onboarding" status={status} />
    </ProviderShell>
  );
}

