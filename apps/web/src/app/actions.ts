"use server";

import { redirect } from "next/navigation";
import { insertFamilyLead } from "./family-leads/db";
import { parseFamilyLeadForm } from "./family-leads/validation.js";

const SUCCESS_URL = "/?lead=success#start";

export async function submitFamilyLead(formData: FormData) {
  const result = parseFamilyLeadForm(formData);

  if (result.spam) {
    redirect(SUCCESS_URL);
  }

  if (!result.ok || !result.data) {
    redirect("/?lead=invalid#start");
  }

  let destination = SUCCESS_URL;

  try {
    await insertFamilyLead(result.data);
  } catch (error) {
    console.error("Failed to save family lead", error);
    destination = "/?lead=error#start";
  }

  redirect(destination);
}
