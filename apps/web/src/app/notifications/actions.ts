"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "../lib/auth";
import {
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
} from "./db";

function parseNotificationId(formData: FormData) {
  const notificationId = Number.parseInt(String(formData.get("notificationId") ?? ""), 10);

  return Number.isInteger(notificationId) && notificationId > 0 ? notificationId : null;
}

function parseFilter(formData: FormData) {
  return formData.get("filter") === "all" ? "all" : "unread";
}

export async function markNotificationRead(formData: FormData) {
  const user = await requireUser();
  const notificationId = parseNotificationId(formData);
  const filter = parseFilter(formData);

  if (!notificationId) {
    redirect(`/account/notifications?filter=${filter}&status=invalid`);
  }

  try {
    await markNotificationReadForUser(user.id, notificationId);
  } catch (error) {
    console.error("Failed to mark notification read", error);
    redirect(`/account/notifications?filter=${filter}&status=error`);
  }

  revalidatePath("/account/notifications");
  redirect(`/account/notifications?filter=${filter}`);
}

export async function markAllNotificationsRead(formData: FormData) {
  const user = await requireUser();
  const filter = parseFilter(formData);

  try {
    await markAllNotificationsReadForUser(user.id);
  } catch (error) {
    console.error("Failed to mark all notifications read", error);
    redirect(`/account/notifications?filter=${filter}&status=error`);
  }

  revalidatePath("/account/notifications");
  redirect(`/account/notifications?filter=${filter}`);
}
