import { providerServiceValues } from "../provider/services.js";

export const requestMatchPreferenceOptions = [
  { value: "specific", label: "This provider" },
];

export const requestUrgencyOptions = [
  { value: "urgent", label: "Urgent" },
  { value: "soon", label: "Soon" },
  { value: "flexible", label: "Flexible" },
];

export const requestDurationOptions = [
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
  { value: 180, label: "3 hours" },
  { value: 240, label: "4 hours" },
];

const SERVICE_VALUES = new Set(providerServiceValues);
const MATCH_PREFERENCES = new Set(requestMatchPreferenceOptions.map((option) => option.value));
const URGENCY_VALUES = new Set(requestUrgencyOptions.map((option) => option.value));
const DURATION_VALUES = new Set(requestDurationOptions.map((option) => option.value));
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LENGTHS = {
  contactName: 120,
  contactEmail: 254,
  contactPhone: 30,
  notes: 1000,
};

function getValue(input, key) {
  const value =
    typeof input.get === "function" ? input.get(key) : (input[key] ?? "");

  return typeof value === "string" ? value.trim() : "";
}

function isValidDateString(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function timeToMinutes(value) {
  if (!TIME_PATTERN.test(value)) return Number.NaN;
  const [hours, minutes] = value.split(":").map((part) => Number.parseInt(part, 10));

  return hours * 60 + minutes;
}

export function getTodayDateString(timeZone = "America/Los_Angeles") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function getCurrentLocalMinutes(now = new Date(), timeZone = "America/Los_Angeles") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return Number.parseInt(values.hour, 10) * 60 + Number.parseInt(values.minute, 10);
}

export function parseServiceRequestForm(
  input,
  { today = getTodayDateString(), now = new Date(), timeZone = "America/Los_Angeles" } = {},
) {
  const providerProfileIdInput = getValue(input, "providerProfileId");
  const providerProfileId = providerProfileIdInput ? Number.parseInt(providerProfileIdInput, 10) : null;
  const durationMinutes = Number.parseInt(getValue(input, "durationMinutes"), 10);
  const matchPreference = getValue(input, "matchPreference") || "specific";
  const data = {
    matchPreference,
    providerProfileId,
    serviceType: getValue(input, "serviceType"),
    zipCode: getValue(input, "zipCode"),
    requestedDate: getValue(input, "requestedDate"),
    windowStartTime: getValue(input, "windowStartTime"),
    windowEndTime: getValue(input, "windowEndTime"),
    durationMinutes,
    urgency: getValue(input, "urgency") || "soon",
    contactName: getValue(input, "contactName"),
    contactEmail: getValue(input, "contactEmail").toLowerCase(),
    contactPhone: getValue(input, "contactPhone"),
    notes: getValue(input, "notes"),
  };
  const errors = {};

  if (!MATCH_PREFERENCES.has(data.matchPreference)) {
    errors.matchPreference = "Select who should receive this request";
  }

  if (!Number.isInteger(data.providerProfileId) || data.providerProfileId <= 0) {
    errors.providerProfileId = "Select a provider";
  }

  if (!SERVICE_VALUES.has(data.serviceType)) {
    errors.serviceType = "Select a service";
  }

  if (!/^\d{5}$/.test(data.zipCode)) {
    errors.zipCode = "Enter a valid 5-digit ZIP code";
  }

  if (!isValidDateString(data.requestedDate)) {
    errors.requestedDate = "Enter a valid date";
  } else if (data.requestedDate < today) {
    errors.requestedDate = "Choose today or a future date";
  }

  const startMinutes = timeToMinutes(data.windowStartTime);
  const endMinutes = timeToMinutes(data.windowEndTime);
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
    errors.timeWindow = "Enter a valid start and end time";
  } else if (startMinutes >= endMinutes) {
    errors.timeWindow = "End time must be after start time";
  } else if (data.requestedDate === today && startMinutes <= getCurrentLocalMinutes(now, timeZone)) {
    errors.timeWindow = "Start time must be in the future";
  }

  if (!DURATION_VALUES.has(data.durationMinutes)) {
    errors.durationMinutes = "Select a supported duration";
  } else if (Number.isFinite(startMinutes) && Number.isFinite(endMinutes)) {
    const windowMinutes = endMinutes - startMinutes;
    if (windowMinutes < data.durationMinutes) {
      errors.durationMinutes = "Duration must fit within the requested time window";
    }
  }

  if (!URGENCY_VALUES.has(data.urgency)) {
    errors.urgency = "Select urgency";
  }

  if (!data.contactName) {
    errors.contactName = "Required";
  }

  if (!data.contactEmail) {
    errors.contactEmail = "Required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) {
    errors.contactEmail = "Enter a valid email";
  }

  const phoneDigits = data.contactPhone.replace(/\D/g, "");
  if (!data.contactPhone) {
    errors.contactPhone = "Required";
  } else if (phoneDigits.length < 7 || phoneDigits.length > 15) {
    errors.contactPhone = "Enter a valid phone number";
  }

  for (const [key, value] of Object.entries(data)) {
    if (!Object.hasOwn(MAX_LENGTHS, key)) continue;
    if (String(value).length > MAX_LENGTHS[key]) {
      errors[key] = "Too long";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, data, errors };
  }

  return { ok: true, data, errors: {} };
}
