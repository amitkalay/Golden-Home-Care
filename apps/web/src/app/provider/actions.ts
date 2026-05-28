"use server";

import { put } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authOptions } from "../lib/auth";
import { createProviderStripeAccountLink } from "../payments/db";
import {
  parseProviderAvailabilityForm,
  parseProviderProfileForm,
  validateProviderPhoto,
} from "./profile-validation.js";
import {
  parseProviderMatchId,
  parseProviderRequestProposalForm,
} from "./request-validation.js";
import {
  acceptProviderRequestMatch as acceptProviderRequestMatchRecord,
  declineProviderRequestMatch as declineProviderRequestMatchRecord,
  ensureDraftProviderProfile,
  proposeProviderRequestTime as proposeProviderRequestTimeRecord,
  saveProviderAvailability as saveProviderAvailabilityRecord,
  saveProviderProfile as saveProviderProfileRecord,
} from "./db";
import {
  notifyAfterProviderAccepted,
  notifyRequesterOfProviderDecline,
  notifyRequesterOfProviderProposal,
} from "../notifications/db";

async function requireProviderUserId() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/sign-in");
  }

  await ensureDraftProviderProfile(userId, session?.user?.name);
  return userId;
}

async function uploadProviderPhoto(userId: string, formData: FormData) {
  const photo = formData.get("photo");

  if (!(photo instanceof File) || photo.size === 0) {
    return null;
  }

  const photoValidation = validateProviderPhoto(photo);
  if (!photoValidation.ok) {
    throw new Error(photoValidation.error ?? "Invalid photo");
  }

  const extension = photo.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension) ? extension : "jpg";
  const blob = await put(`provider-photos/${userId}/${Date.now()}.${safeExtension}`, photo, {
    access: "public",
    addRandomSuffix: true,
  });

  return blob.url;
}

async function saveProfile(formData: FormData, invalidRedirect: string, successRedirect: string) {
  const userId = await requireProviderUserId();
  const result = parseProviderProfileForm(formData);

  if (!result.ok) {
    redirect(invalidRedirect);
  }

  try {
    const photoUrl = await uploadProviderPhoto(userId, formData);
    await saveProviderProfileRecord(userId, result.data, photoUrl);
  } catch (error) {
    console.error("Failed to save provider profile", error);
    redirect(`${invalidRedirect.replace("invalid", "error")}`);
  }

  revalidatePath("/provider");
  revalidatePath("/provider/profile");
  revalidatePath("/providers");
  redirect(successRedirect);
}

export async function saveProviderOnboarding(formData: FormData) {
  await saveProfile(formData, "/provider/onboarding?status=invalid", "/provider?profile=active");
}

export async function saveProviderProfile(formData: FormData) {
  await saveProfile(formData, "/provider/profile?status=invalid", "/provider/profile?status=saved");
}

export async function saveProviderAvailability(formData: FormData) {
  const userId = await requireProviderUserId();
  const result = parseProviderAvailabilityForm(formData);

  if (!result.ok) {
    redirect("/provider/availability?status=invalid");
  }

  try {
    await saveProviderAvailabilityRecord(userId, result.data);
  } catch (error) {
    console.error("Failed to save provider availability", error);
    redirect("/provider/availability?status=error");
  }

  revalidatePath("/provider");
  revalidatePath("/provider/availability");
  revalidatePath("/providers");
  redirect("/provider/availability?status=saved");
}

export async function startStripeProviderOnboarding() {
  const userId = await requireProviderUserId();

  let onboardingUrl: string;
  try {
    onboardingUrl = await createProviderStripeAccountLink(userId);
  } catch (error) {
    console.error("Failed to create Stripe provider onboarding link", error);
    redirect("/provider?stripe=error");
  }

  redirect(onboardingUrl);
}

export async function acceptProviderRequestMatch(formData: FormData) {
  const userId = await requireProviderUserId();
  const matchId = parseProviderMatchId(formData);

  if (!matchId) {
    redirect("/provider/messages?status=invalid");
  }

  let result: Awaited<ReturnType<typeof acceptProviderRequestMatchRecord>>;
  try {
    result = await acceptProviderRequestMatchRecord(userId, matchId);
  } catch (error) {
    console.error("Failed to accept provider request match", error);
    redirect("/provider/messages?status=error");
  }

  if (!result.updated) {
    if (result.reason === "stripe_required") {
      redirect("/provider/messages?status=stripe-required");
    }

    if (result.reason === "rate_required") {
      redirect("/provider/messages?status=rate-required");
    }

    redirect("/provider/messages?status=invalid");
  }

  try {
    await notifyAfterProviderAccepted(matchId);
  } catch (error) {
    console.error("Failed to send provider acceptance notifications", error);
  }

  revalidatePath("/account/notifications");
  revalidatePath("/account/requests");
  revalidatePath("/provider/messages");
  redirect("/provider/messages?status=accepted&tab=accepted");
}

export async function declineProviderRequestMatch(formData: FormData) {
  const userId = await requireProviderUserId();
  const matchId = parseProviderMatchId(formData);

  if (!matchId) {
    redirect("/provider/messages?status=invalid");
  }

  let updated = false;
  try {
    updated = await declineProviderRequestMatchRecord(userId, matchId);
  } catch (error) {
    console.error("Failed to decline provider request match", error);
    redirect("/provider/messages?status=error");
  }

  if (!updated) {
    redirect("/provider/messages?status=invalid");
  }

  try {
    await notifyRequesterOfProviderDecline(matchId);
  } catch (error) {
    console.error("Failed to send provider decline notification", error);
  }

  revalidatePath("/account/notifications");
  revalidatePath("/provider/messages");
  redirect("/provider/messages?status=declined&tab=closed");
}

export async function proposeProviderRequestTime(formData: FormData) {
  const userId = await requireProviderUserId();
  const result = parseProviderRequestProposalForm(formData);

  if (!result.ok || !result.data.matchId) {
    redirect("/provider/messages?status=invalid");
  }

  let updated = false;
  try {
    updated = await proposeProviderRequestTimeRecord(userId, result.data.matchId, {
      proposedDate: result.data.proposedDate,
      proposedStartTime: result.data.proposedStartTime,
      proposedEndTime: result.data.proposedEndTime,
      providerResponseNote: result.data.providerResponseNote,
    });
  } catch (error) {
    console.error("Failed to propose provider request time", error);
    redirect("/provider/messages?status=error");
  }

  if (!updated) {
    redirect("/provider/messages?status=invalid");
  }

  try {
    await notifyRequesterOfProviderProposal(result.data.matchId);
  } catch (error) {
    console.error("Failed to send provider proposal notification", error);
  }

  revalidatePath("/account/notifications");
  revalidatePath("/provider/messages");
  redirect("/provider/messages?status=proposed&tab=proposed");
}
