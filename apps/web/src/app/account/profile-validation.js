export const MAX_ACCOUNT_PHOTO_BYTES = 4 * 1024 * 1024;

const MAX_LENGTHS = {
  name: 120,
  bio: 500,
};

function getValue(input, key) {
  const value = typeof input.get === "function" ? input.get(key) : (input[key] ?? "");
  return typeof value === "string" ? value.trim() : "";
}

function withinLimit(value, key) {
  return value.length <= MAX_LENGTHS[key];
}

export function validateAccountPhoto(file) {
  if (!file || typeof file !== "object" || file.size === 0) {
    return { ok: true, error: null };
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return { ok: false, error: "Upload a JPEG, PNG, or WebP image" };
  }

  if (file.size > MAX_ACCOUNT_PHOTO_BYTES) {
    return { ok: false, error: "Photo must be 4 MB or smaller" };
  }

  return { ok: true, error: null };
}

export function parseAccountProfileForm(input) {
  const data = {
    name: getValue(input, "name"),
    bio: getValue(input, "bio"),
  };
  const errors = {};

  if (!data.name) {
    errors.name = "Required";
  }

  for (const [key, value] of Object.entries(data)) {
    if (!withinLimit(value, key)) {
      errors[key] = "Too long";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, data, errors };
  }

  return { ok: true, data, errors: {} };
}
