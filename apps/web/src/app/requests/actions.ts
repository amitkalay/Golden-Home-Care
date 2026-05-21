"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "../lib/auth";
import { geocodeZipCode } from "../lib/zip-geocode";
import {
  cancelServiceRequestForRequester,
  createServiceRequest as createServiceRequestRecord,
  getActiveRequestProviderTarget,
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

export async function createServiceRequest(formData: FormData) {
  const user = await requireUser();
  const result = parseServiceRequestForm(formData);

  if (!result.ok) {
    redirect("/requests/new?status=invalid");
  }

  const location = await geocodeZipCode(result.data.zipCode);
  if (!location) {
    redirect("/requests/new?status=invalid");
  }

  const matchPreference = result.data.matchPreference === "specific" ? "specific" : "any";
  const urgency =
    result.data.urgency === "urgent" || result.data.urgency === "flexible"
      ? result.data.urgency
      : "soon";
  let providerProfileId: number | null = null;

  if (matchPreference === "specific") {
    const specificProviderProfileId = result.data.providerProfileId;

    if (!specificProviderProfileId) {
      redirect("/requests/new?status=invalid");
    }

    const target = await getActiveRequestProviderTarget(specificProviderProfileId);
    const targetOffersService = target?.services.some(
      (service) => service.serviceType === result.data.serviceType,
    );

    if (!target || !targetOffersService) {
      redirect("/requests/new?status=invalid");
    }

    providerProfileId = specificProviderProfileId;
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
    console.error("Failed to create service request", error);
    redirect("/requests/new?status=error");
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
