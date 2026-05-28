"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "../lib/auth";
import { geocodeZipCode } from "../lib/zip-geocode";
import { createBookingCheckoutSession } from "../payments/db";
import {
  cancelServiceRequestForRequester,
  createServiceRequest as createServiceRequestRecord,
  getActiveRequestProviderTarget,
  UnavailableProviderMatchError,
} from "./db";
import {
  notifyProvidersOfNewRequest,
  notifyProvidersOfRequesterCancellation,
} from "../notifications/db";
import { parseServiceRequestForm } from "./validation.js";

function parseRequestId(formData: FormData) {
  const requestId = Number.parseInt(String(formData.get("requestId") ?? ""), 10);

  return Number.isInteger(requestId) && requestId > 0 ? requestId : null;
}

function buildNewRequestRedirect(
  status: "invalid" | "error" | "provider-required" | "unavailable",
  input?: {
    providerProfileId?: number | null;
    serviceType?: string;
    zipCode?: string;
  },
) {
  const params = new URLSearchParams({ status });

  if (input?.providerProfileId) {
    params.set("providerId", String(input.providerProfileId));
    params.set("matchPreference", "specific");
  }
  if (input?.serviceType) params.set("service", input.serviceType);
  if (input?.zipCode) params.set("zip", input.zipCode);

  return `/requests/new?${params.toString()}`;
}

export async function createServiceRequest(formData: FormData) {
  const user = await requireUser();
  const result = parseServiceRequestForm(formData);

  if (!result.ok) {
    redirect(buildNewRequestRedirect("invalid", result.data));
  }

  const location = await geocodeZipCode(result.data.zipCode);
  if (!location) {
    redirect(buildNewRequestRedirect("invalid", result.data));
  }

  if (result.data.matchPreference !== "specific" || !result.data.providerProfileId) {
    redirect(buildNewRequestRedirect("provider-required", result.data));
  }

  const matchPreference = "specific";
  const urgency =
    result.data.urgency === "urgent" || result.data.urgency === "flexible"
      ? result.data.urgency
      : "soon";
  const providerProfileId = result.data.providerProfileId;
  const target = await getActiveRequestProviderTarget(providerProfileId);
  const targetOffersService = target?.services.some(
    (service) => service.serviceType === result.data.serviceType,
  );

  if (!target || !targetOffersService) {
    redirect(buildNewRequestRedirect("provider-required", result.data));
  }

  let requestId: number;
  try {
    requestId = await createServiceRequestRecord(user.id, {
      ...result.data,
      matchPreference,
      providerProfileId,
      urgency,
    }, location);
  } catch (error) {
    if (error instanceof UnavailableProviderMatchError) {
      redirect(buildNewRequestRedirect("unavailable", result.data));
    }

    console.error("Failed to create service request", error);
    redirect(buildNewRequestRedirect("error", result.data));
  }

  try {
    await notifyProvidersOfNewRequest(requestId);
  } catch (error) {
    console.error("Failed to notify matched providers", error);
  }

  revalidatePath("/requests/new");
  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/account/notifications");
  redirect(`/requests/${requestId}`);
}

export async function cancelServiceRequest(formData: FormData) {
  const user = await requireUser();
  const requestId = parseRequestId(formData);

  if (!requestId) {
    redirect("/account/requests?status=invalid");
  }

  let updateResult: { updated: boolean; affectedMatchIds: number[] };
  try {
    updateResult = await cancelServiceRequestForRequester(requestId, user.id);
  } catch (error) {
    console.error("Failed to cancel service request", error);
    redirect("/account/requests?status=error");
  }

  if (!updateResult.updated) {
    redirect("/account/requests?status=invalid");
  }

  try {
    await notifyProvidersOfRequesterCancellation(updateResult.affectedMatchIds);
  } catch (error) {
    console.error("Failed to notify providers about request cancellation", error);
  }

  revalidatePath("/account/requests");
  revalidatePath("/account/notifications");
  revalidatePath(`/requests/${requestId}`);
  redirect("/account/requests?status=canceled&tab=canceled");
}

export async function payForServiceRequest(formData: FormData) {
  const user = await requireUser();
  const requestId = parseRequestId(formData);

  if (!requestId) {
    redirect("/account/requests?status=invalid");
  }

  let checkoutUrl: string;
  try {
    checkoutUrl = await createBookingCheckoutSession(requestId, user.id);
  } catch (error) {
    console.error("Failed to create Stripe Checkout session", error);
    redirect(`/requests/${requestId}?payment=error`);
  }

  redirect(checkoutUrl);
}
