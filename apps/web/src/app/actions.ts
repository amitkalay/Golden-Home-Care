"use server";

import { redirect } from "next/navigation";
import { insertFamilyLead } from "./family-leads/db";
import { parseFamilyLeadForm } from "./family-leads/validation.js";
import { insertServiceProviderLead } from "./provider-leads/db";
import { parseServiceProviderLeadForm } from "./provider-leads/validation.js";

const FAMILY_SUCCESS_URL = "/?lead=success#start";
const PROVIDER_SUCCESS_URL = "/?providerLead=success#start";

export async function submitFamilyLead(formData: FormData) {
  const result = parseFamilyLeadForm(formData);

  if (result.spam) {
    redirect(FAMILY_SUCCESS_URL);
  }

  if (!result.ok || !result.data) {
    redirect("/?lead=invalid#start");
  }

  let destination = FAMILY_SUCCESS_URL;

  try {
    await insertFamilyLead(result.data);
  } catch (error) {
    console.error("Failed to save family lead", error);
    destination = "/?lead=error#start";
  }

  redirect(destination);
}

export async function submitServiceProviderLead(formData: FormData) {
  const result = parseServiceProviderLeadForm(formData);

  if (result.spam) {
    redirect(PROVIDER_SUCCESS_URL);
  }

  if (!result.ok || !result.data) {
    redirect("/?providerLead=invalid#start");
  }

  let destination = PROVIDER_SUCCESS_URL;

  try {
    await insertServiceProviderLead(result.data);
  } catch (error) {
    console.error("Failed to save service provider lead", error);
    destination = "/?providerLead=error#start";
  }

  redirect(destination);
}
