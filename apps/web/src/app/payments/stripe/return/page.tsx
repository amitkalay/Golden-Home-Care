import { redirect } from "next/navigation";
import { requireUser } from "../../../lib/auth";
import { reconcileCheckoutSessionForRequester } from "../../db";

export const dynamic = "force-dynamic";

type StripeReturnPageProps = {
  searchParams?: Promise<{
    session_id?: string | string[];
  }>;
};

function getParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StripeReturnPage({ searchParams }: StripeReturnPageProps) {
  const user = await requireUser();
  const params = searchParams ? await searchParams : {};
  const sessionId = getParam(params.session_id);

  if (!sessionId) {
    redirect("/account/requests?status=invalid");
  }

  try {
    const requestId = await reconcileCheckoutSessionForRequester(sessionId, user.id);
    redirect(`/requests/${requestId}`);
  } catch (error) {
    console.error("Failed to reconcile Stripe Checkout return", error);
    redirect("/account/requests?status=error");
  }
}
