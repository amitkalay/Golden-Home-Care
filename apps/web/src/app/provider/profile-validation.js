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
export const defaultAvailabilityTimezone = "America/Los_Angeles";
export const availabilityTimezoneOptions = [
  { value: "America/Los_Angeles", label: "Pacific time" },
  { value: "America/Denver", label: "Mountain time" },
  { value: "America/Chicago", label: "Central time" },
  { value: "America/New_York", label: "Eastern time" },
];
export const minimumNoticeOptions = [
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 240, label: "4 hours" },
  { value: 720, label: "12 hours" },
  { value: 1440, label: "24 hours" },
  { value: 2880, label: "48 hours" },
];
export const availabilityDayOptions = [
  { value: 0, label: "Sunday", shortLabel: "Sun" },
  { value: 1, label: "Monday", shortLabel: "Mon" },
  { value: 2, label: "Tuesday", shortLabel: "Tue" },
  { value: 3, label: "Wednesday", shortLabel: "Wed" },
  { value: 4, label: "Thursday", shortLabel: "Thu" },
  { value: 5, label: "Friday", shortLabel: "Fri" },
  { value: 6, label: "Saturday", shortLabel: "Sat" },
];

const SERVICE_VALUES = new Set(providerServiceValues);
const TIMEZONE_VALUES = new Set(availabilityTimezoneOptions.map((option) => option.value));
const MINIMUM_NOTICE_VALUES = new Set(minimumNoticeOptions.map((option) => option.value));
const MAX_LENGTHS = {
  displayName: 120,
  email: 254,
  phone: 30,
  zipCode: 10,
  bio: 1000,
  experienceSummary: 1000,
  languages: 240,
};
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

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

function parseDay(value) {
  if (!/^\d$/.test(value)) return Number.NaN;
  const day = Number.parseInt(value, 10);
  return day >= 0 && day <= 6 ? day : Number.NaN;
}

function compareTimes(startTime, endTime) {
  return startTime.localeCompare(endTime);
}

function formatAvailabilityTime(value) {
  const [hourInput, minute] = value.split(":");
  const hour = Number.parseInt(hourInput, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
}

function formatMinimumNotice(minutes) {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

export function getAvailabilityTimezoneLabel(timezone) {
  return availabilityTimezoneOptions.find((option) => option.value === timezone)?.label ?? timezone;
}

/**
 * @param {{
 *   windows?: Array<{ dayOfWeek: number, startTime: string, endTime: string }>,
 *   timezone?: string,
 *   onDemandAvailable?: boolean,
 *   minimumNoticeMinutes?: number,
 *   fallbackSummary?: string,
 * }} options
 */
export function generateAvailabilitySummary({
  windows = [],
  timezone = defaultAvailabilityTimezone,
  onDemandAvailable = false,
  minimumNoticeMinutes = 120,
  fallbackSummary = "",
} = {}) {
  if (!windows.length) return fallbackSummary;

  const timezoneLabel = getAvailabilityTimezoneLabel(timezone);
  const windowsSummary = windows
    .map((window) => {
      const day = availabilityDayOptions.find((option) => option.value === window.dayOfWeek);
      return `${day?.shortLabel ?? window.dayOfWeek} ${formatAvailabilityTime(window.startTime)}-${formatAvailabilityTime(window.endTime)}`;
    })
    .join("; ");
  const onDemandSummary = onDemandAvailable
    ? ` On-demand requests accepted with ${formatMinimumNotice(minimumNoticeMinutes)} notice.`
    : "";

  return `${windowsSummary} ${timezoneLabel}.${onDemandSummary}`.trim();
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
  const selectedDayValues = Array.from(new Set(getValues(input, "availableDays")));
  const selectedDays = selectedDayValues.map(parseDay);
  const windows = [];
  const minimumNoticeMinutes = Number.parseInt(getValue(input, "minimumNoticeMinutes"), 10);
  const data = {
    windows,
    availabilityTimezone: getValue(input, "availabilityTimezone") || defaultAvailabilityTimezone,
    onDemandAvailable: getBoolean(input, "onDemandAvailable"),
    minimumNoticeMinutes,
    availabilitySummary: "",
  };
  const errors = {};

  if (!selectedDayValues.length) {
    errors.availableDays = "Select at least one available day";
  }

  if (selectedDays.some((day) => !Number.isInteger(day))) {
    errors.availableDays = "Select valid available days";
  }

  if (!TIMEZONE_VALUES.has(data.availabilityTimezone)) {
    errors.availabilityTimezone = "Select a supported timezone";
  }

  if (!MINIMUM_NOTICE_VALUES.has(data.minimumNoticeMinutes)) {
    errors.minimumNoticeMinutes = "Select a supported minimum notice";
  }

  for (const day of selectedDays) {
    if (!Number.isInteger(day)) continue;

    const startTime = getValue(input, `startTime-${day}`);
    const endTime = getValue(input, `endTime-${day}`);

    if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
      errors.availabilityWindows = "Enter valid start and end times for each selected day";
      continue;
    }

    if (compareTimes(startTime, endTime) >= 0) {
      errors.availabilityWindows = "End time must be after start time";
      continue;
    }

    windows.push({ dayOfWeek: day, startTime, endTime });
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, data, errors };
  }

  windows.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
  data.availabilitySummary = generateAvailabilitySummary({
    windows,
    timezone: data.availabilityTimezone,
    onDemandAvailable: data.onDemandAvailable,
    minimumNoticeMinutes: data.minimumNoticeMinutes,
  });

  return { ok: true, data, errors: {} };
}
