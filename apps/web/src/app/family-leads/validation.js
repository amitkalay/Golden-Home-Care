export const helpNeededOptions = [
  { value: "companionship", label: "Companionship" },
  { value: "errands", label: "Errands" },
  { value: "walks", label: "Walks" },
  { value: "medication-reminders", label: "Medication reminders" },
];

export const relationshipOptions = [
  "Adult child",
  "Spouse or partner",
  "Relative",
  "Friend or neighbor",
  "Other",
];

export const frequencyOptions = ["One-time", "Weekly", "2x/week", "Unsure"];

export const neededTimelineOptions = [
  "As soon as possible",
  "This week",
  "This month",
  "Just exploring",
];

const HELP_VALUES = new Set(helpNeededOptions.map((option) => option.value));
const MAX_LENGTHS = {
  name: 120,
  email: 254,
  phone: 30,
  zipCode: 10,
  relationship: 80,
  frequency: 40,
  neededTimeline: 80,
  notes: 1000,
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

function withinLimit(value, key) {
  return value.length <= MAX_LENGTHS[key];
}

export function parseFamilyLeadForm(input) {
  const honeypot = getValue(input, "companyWebsite");

  if (honeypot) {
    return { ok: true, spam: true, data: null, errors: {} };
  }

  const data = {
    name: getValue(input, "name"),
    email: getValue(input, "email").toLowerCase(),
    phone: getValue(input, "phone"),
    zipCode: getValue(input, "zipCode"),
    relationship: getValue(input, "relationship"),
    helpNeeded: Array.from(new Set(getValues(input, "helpNeeded"))),
    frequency: getValue(input, "frequency"),
    neededTimeline: getValue(input, "neededTimeline"),
    notes: getValue(input, "notes"),
  };
  const errors = {};

  for (const key of ["name", "email", "phone", "relationship", "frequency", "neededTimeline"]) {
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

  if (data.zipCode && !/^\d{5}(-\d{4})?$/.test(data.zipCode)) {
    errors.zipCode = "Enter a valid ZIP code";
  }

  const invalidHelpNeeded = data.helpNeeded.some((value) => !HELP_VALUES.has(value));
  if (!data.helpNeeded.length || invalidHelpNeeded) {
    errors.helpNeeded = "Select at least one option";
  }

  for (const [key, value] of Object.entries(data)) {
    if (key === "helpNeeded") continue;
    if (!withinLimit(value, key)) {
      errors[key] = "Too long";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, spam: false, data, errors };
  }

  return { ok: true, spam: false, data, errors: {} };
}
