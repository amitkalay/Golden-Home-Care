"use server";

import { put } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authOptions } from "../lib/auth";
import {
  parseProviderAvailabilityForm,
  parseProviderProfileForm,
  validateProviderPhoto,
} from "./profile-validation.js";
import {
  ensureDraftProviderProfile,
  saveProviderAvailability as saveProviderAvailabilityRecord,
  saveProviderProfile as saveProviderProfileRecord,
} from "./db";

async function requireProviderUserId() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/sign-in");
  }

  await ensureDraftProviderProfile(userId, session?.user?.name, session?.user?.image);
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
