import { providerServiceValues } from "./services.js";

export const providerStatusOptions = [
  "draft",
  "submitted",
  "approved",
  "active",
  "paused",
  "rejected",
];

export const MAX_PROVIDER_PHOTO_BYTES = 4 * 1024 * 1024;

const SERVICE_VALUES = new Set(providerServiceValues);
const MAX_LENGTHS = {
  displayName: 120,
  email: 254,
  phone: 30,
  zipCode: 10,
  bio: 1000,
  experienceSummary: 1000,
  languages: 240,
  availabilitySummary: 500,
};

function getValue(input, key) {
  const value =
    typeof input.get === "function" ? input.get(key) : (input[key] ?? "");

  return typeof value === "string" ? value.trim() : "";
}

function getValues(input, key) {
  const values =
    typeof input.getAll === "function" ? input.getAll(key) : (input[key] ?? []);

  return (Array.isArray(values) ? values : [values])
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getBoolean(input, key) {
  return getValue(input, key) === "yes" || getValue(input, key) === "on";
}

function withinLimit(value, key) {
  return value.length <= MAX_LENGTHS[key];
}

export function parseLanguages(value) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((language) => language.trim())
        .filter(Boolean),
    ),
  );
}

export function validateProviderPhoto(file) {
  if (!file || typeof file !== "object" || file.size === 0) {
    return { ok: true, error: null };
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return { ok: false, error: "Upload a JPEG, PNG, or WebP image" };
  }

  if (file.size > MAX_PROVIDER_PHOTO_BYTES) {
    return { ok: false, error: "Photo must be 4 MB or smaller" };
  }

  return { ok: true, error: null };
}

export function parseProviderProfileForm(input) {
  const presetServices = getValues(input, "servicesOffered");
  const serviceRadiusMiles = Number.parseInt(getValue(input, "serviceRadiusMiles"), 10);
  const hourlyRateDollars = getValue(input, "hourlyRate");
  const hourlyRate = Number.parseInt(hourlyRateDollars, 10);

  const data = {
    displayName: getValue(input, "displayName"),
    email: getValue(input, "email").toLowerCase(),
    phone: getValue(input, "phone"),
    zipCode: getValue(input, "zipCode"),
    serviceRadiusMiles,
    hourlyRateCents: Number.isFinite(hourlyRate) ? hourlyRate * 100 : Number.NaN,
    servicesOffered: Array.from(new Set(presetServices)),
    bio: getValue(input, "bio"),
    experienceSummary: getValue(input, "experienceSummary"),
    languages: parseLanguages(getValue(input, "languages")),
    languagesInput: getValue(input, "languages"),
    availabilitySummary: getValue(input, "availabilitySummary"),
    transportationAvailable: getBoolean(input, "transportationAvailable"),
    backgroundCheckWilling: getBoolean(input, "backgroundCheckWilling"),
  };
  const errors = {};

  for (const key of [
    "displayName",
    "email",
    "phone",
    "zipCode",
    "bio",
    "experienceSummary",
    "availabilitySummary",
  ]) {
    if (!data[key]) {
      errors[key] = "Required";
    }
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = "Enter a valid email";
  }

  const phoneDigits = data.phone.replace(/\D/g, "");
  if (data.phone && (phoneDigits.length < 7 || phoneDigits.length > 15)) {
    errors.phone = "Enter a valid phone number";
  }

  if (data.zipCode && !/^\d{5}$/.test(data.zipCode)) {
    errors.zipCode = "Enter a valid 5-digit ZIP code";
  }

  if (!Number.isInteger(data.serviceRadiusMiles) || data.serviceRadiusMiles < 1 || data.serviceRadiusMiles > 100) {
    errors.serviceRadiusMiles = "Enter a service radius from 1 to 100 miles";
  }

  if (!/^\d+$/.test(hourlyRateDollars) || hourlyRate < 1 || hourlyRate > 250) {
    errors.hourlyRate = "Enter a whole-number hourly rate from 1 to 250";
  }

  const invalidServices = presetServices.some((value) => !SERVICE_VALUES.has(value));
  if (!data.servicesOffered.length || invalidServices) {
    errors.servicesOffered = "Select at least one service";
  }

  if (!data.languages.length) {
    errors.languages = "Enter at least one language";
  }

  for (const [key, value] of Object.entries(data)) {
    if (!Object.hasOwn(MAX_LENGTHS, key)) continue;
    if (!withinLimit(value, key)) {
      errors[key] = "Too long";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, data, errors };
  }

  return { ok: true, data, errors: {} };
}

export function parseProviderAvailabilityForm(input) {
  const data = {
    availabilitySummary: getValue(input, "availabilitySummary"),
    transportationAvailable: getBoolean(input, "transportationAvailable"),
    backgroundCheckWilling: getBoolean(input, "backgroundCheckWilling"),
  };
  const errors = {};

  if (!data.availabilitySummary) {
    errors.availabilitySummary = "Required";
  }

  if (!withinLimit(data.availabilitySummary, "availabilitySummary")) {
    errors.availabilitySummary = "Too long";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, data, errors };
  }

  return { ok: true, data, errors: {} };
}

