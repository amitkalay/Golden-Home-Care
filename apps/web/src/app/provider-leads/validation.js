export const providerServiceOptions = [
  { value: "meal-prep", label: "Meal Prep" },
  { value: "gardening", label: "Gardening" },
  { value: "companionship", label: "Companionship" },
  { value: "errands", label: "Errands" },
  { value: "walks", label: "Walks" },
];

export const seniorCareExperienceOptions = [
  "No professional experience",
  "Less than 1 year",
  "1-2 years",
  "3-5 years",
  "5+ years",
];

export const availabilityOptions = [
  "Weekdays",
  "Weekends",
  "Evenings",
  "Flexible / varies",
];

const SERVICE_VALUES = new Set(providerServiceOptions.map((option) => option.value));
const EXPERIENCE_VALUES = new Set(seniorCareExperienceOptions);
const AVAILABILITY_VALUES = new Set(availabilityOptions);
const MAX_LENGTHS = {
  name: 120,
  email: 254,
  phone: 30,
  serviceArea: 120,
  hourlyRate: 20,
  servicesOfferedOther: 160,
  seniorCareExperience: 80,
  availability: 80,
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

function parseBackgroundCheck(value) {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

export function parseServiceProviderLeadForm(input) {
  const honeypot = getValue(input, "providerCompanyWebsite");

  if (honeypot) {
    return { ok: true, spam: true, data: null, errors: {} };
  }

  const presetServices = getValues(input, "servicesOffered");
  const servicesOfferedOther = getValue(input, "servicesOfferedOther");
  const servicesOffered = Array.from(
    new Set(servicesOfferedOther ? [...presetServices, servicesOfferedOther] : presetServices),
  );
  const backgroundCheckValue = getValue(input, "backgroundCheckWilling");

  const data = {
    name: getValue(input, "name"),
    email: getValue(input, "email").toLowerCase(),
    phone: getValue(input, "phone"),
    serviceArea: getValue(input, "serviceArea"),
    hourlyRate: getValue(input, "hourlyRate"),
    servicesOffered,
    servicesOfferedOther,
    seniorCareExperience: getValue(input, "seniorCareExperience"),
    availability: getValue(input, "availability"),
    backgroundCheckWilling: parseBackgroundCheck(backgroundCheckValue),
    notes: getValue(input, "notes"),
  };
  const errors = {};

  for (const key of ["name", "email", "serviceArea", "hourlyRate", "seniorCareExperience", "availability"]) {
    if (!data[key]) {
      errors[key] = "Required";
    }
  }

  if (data.backgroundCheckWilling === null) {
    errors.backgroundCheckWilling = "Required";
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = "Enter a valid email";
  }

  const phoneDigits = data.phone.replace(/\D/g, "");
  if (data.phone && (phoneDigits.length < 7 || phoneDigits.length > 15)) {
    errors.phone = "Enter a valid phone number";
  }

  if (data.hourlyRate && !/^\d+$/.test(data.hourlyRate)) {
    errors.hourlyRate = "Enter a whole-number hourly rate";
  }

  const invalidServices = presetServices.some((value) => !SERVICE_VALUES.has(value));
  if (!data.servicesOffered.length || invalidServices) {
    errors.servicesOffered = "Select at least one service";
  }

  if (data.seniorCareExperience && !EXPERIENCE_VALUES.has(data.seniorCareExperience)) {
    errors.seniorCareExperience = "Select a valid experience level";
  }

  if (data.availability && !AVAILABILITY_VALUES.has(data.availability)) {
    errors.availability = "Select a valid availability";
  }

  for (const [key, value] of Object.entries(data)) {
    if (key === "servicesOffered" || key === "backgroundCheckWilling") continue;
    if (!withinLimit(value, key)) {
      errors[key] = "Too long";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, spam: false, data, errors };
  }

  return { ok: true, spam: false, data, errors: {} };
}
