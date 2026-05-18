"use server";

import { put } from "@vercel/blob";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "../lib/auth";
import {
  deleteUserAccount,
  updateUserAccount,
} from "./db";
import {
  parseAccountProfileForm,
  validateAccountPhoto,
} from "./profile-validation.js";

async function uploadAccountPhoto(userId: string, formData: FormData) {
  const photo = formData.get("photo");

  if (!(photo instanceof File) || photo.size === 0) {
    return null;
  }

  const photoValidation = validateAccountPhoto(photo);
  if (!photoValidation.ok) {
    throw new Error(photoValidation.error ?? "Invalid photo");
  }

  const extension = photo.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension) ? extension : "jpg";
  const blob = await put(`account-photos/${userId}/${Date.now()}.${safeExtension}`, photo, {
    access: "public",
    addRandomSuffix: true,
  });

  return blob.url;
}

function revalidateAccountSurfaces() {
  revalidatePath("/");
  revalidatePath("/account");
  revalidatePath("/provider");
  revalidatePath("/provider/profile");
  revalidatePath("/providers");
}

export async function saveAccountProfile(formData: FormData) {
  const user = await requireUser();
  const result = parseAccountProfileForm(formData);

  if (!result.ok) {
    redirect("/account?status=invalid");
  }

  try {
    const imageUrl = await uploadAccountPhoto(user.id, formData);
    await updateUserAccount(user.id, result.data, imageUrl);
  } catch (error) {
    console.error("Failed to save account profile", error);
    redirect("/account?status=error");
  }

  revalidateAccountSurfaces();
  redirect("/account?status=saved");
}

export async function deleteCurrentAccount(formData: FormData) {
  const user = await requireUser();
  const confirmation = formData.get("confirmation");

  if (confirmation !== "DELETE") {
    redirect("/account/delete?step=confirm&status=invalid");
  }

  try {
    await deleteUserAccount(user.id);
  } catch (error) {
    console.error("Failed to delete account", error);
    redirect("/account/delete?step=confirm&status=error");
  }

  revalidateAccountSurfaces();

  const cookieStore = await cookies();
  for (const cookieName of [
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "authjs.session-token",
    "__Secure-authjs.session-token",
  ]) {
    cookieStore.delete(cookieName);
  }

  redirect("/");
}
