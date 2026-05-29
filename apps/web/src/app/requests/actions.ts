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

export type CreateServiceRequestFieldErrors = Partial<Record<string, string>>;

export type CreateServiceRequestState = {
  message: string;
  fieldErrors: CreateServiceRequestFieldErrors;
  values: Record<string, string>;
};

function parseRequestId(formData: FormData) {
  const requestId = Number.parseInt(String(formData.get("requestId") ?? ""), 10);

  return Number.isInteger(requestId) && requestId > 0 ? requestId : null;
}

function getStringValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function getSubmittedValues(formData: FormData) {
  return {
    providerProfileId: getStringValue(formData, "providerProfileId"),
    matchPreference: getStringValue(formData, "matchPreference"),
    serviceType: getStringValue(formData, "serviceType"),
    zipCode: getStringValue(formData, "zipCode"),
    requestedDate: getStringValue(formData, "requestedDate"),
    durationMinutes: getStringValue(formData, "durationMinutes"),
    windowStartTime: getStringValue(formData, "windowStartTime"),
    windowEndTime: getStringValue(formData, "windowEndTime"),
    urgency: getStringValue(formData, "urgency"),
    contactName: getStringValue(formData, "contactName"),
    contactEmail: getStringValue(formData, "contactEmail"),
    contactPhone: getStringValue(formData, "contactPhone"),
    notes: getStringValue(formData, "notes"),
  };
}

function getErrorMessage(fieldErrors: CreateServiceRequestFieldErrors) {
  const messages = [...new Set(Object.values(fieldErrors).filter(Boolean))];

  return messages.length ? `Please fix: ${messages.join("; ")}` : "Please fix the highlighted fields.";
}

function buildRequestErrorState(
  formData: FormData,
  fieldErrors: CreateServiceRequestFieldErrors,
): CreateServiceRequestState {
  return {
    message: getErrorMessage(fieldErrors),
    fieldErrors,
    values: getSubmittedValues(formData),
  };
}

export async function createServiceRequest(
  _previousState: CreateServiceRequestState,
  formData: FormData,
) {
  const user = await requireUser();
  const result = parseServiceRequestForm(formData);

  if (!result.ok) {
    return buildRequestErrorState(formData, result.errors as CreateServiceRequestFieldErrors);
  }

  const location = await geocodeZipCode(result.data.zipCode);
  if (!location) {
    return buildRequestErrorState(formData, {
      zipCode: "Enter a ZIP code we can locate",
    });
  }

  if (result.data.matchPreference !== "specific" || !result.data.providerProfileId) {
    return buildRequestErrorState(formData, {
      providerProfileId: "Choose an active provider before submitting",
    });
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
    return buildRequestErrorState(formData, {
      serviceType: target ? "This provider does not offer the selected service" : "Choose an active provider before submitting",
    });
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
      return buildRequestErrorState(formData, {
        timeWindow: "This provider is not available for the selected date, time, duration, or existing bookings",
      });
    }

    console.error("Failed to create service request", error);
    return buildRequestErrorState(formData, {
      form: "We could not submit your request. Try again.",
    });
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
