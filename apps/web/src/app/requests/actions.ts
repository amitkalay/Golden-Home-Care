"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "../lib/auth";
import { geocodeZipCode } from "../lib/zip-geocode";
import {
  createServiceRequest as createServiceRequestRecord,
  getActiveRequestProviderTarget,
} from "./db";
import { parseServiceRequestForm } from "./validation.js";

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

  revalidatePath("/requests/new");
  revalidatePath(`/requests/${requestId}`);
  redirect(`/requests/${requestId}`);
}
