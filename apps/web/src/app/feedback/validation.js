export const FEEDBACK_RECIPIENT_EMAIL = "amitkalay8@gmail.com";
export const MAX_FEEDBACK_MESSAGE_LENGTH = 3000;
export const MAX_FEEDBACK_NAME_LENGTH = 120;
export const MAX_FEEDBACK_IMAGE_COUNT = 3;
export const MAX_FEEDBACK_IMAGE_TOTAL_BYTES = 10 * 1024 * 1024;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getValue(input, key) {
  const value = typeof input.get === "function" ? input.get(key) : (input[key] ?? "");
  return typeof value === "string" ? value.trim() : "";
}

function getFiles(input, key) {
  const values = typeof input.getAll === "function" ? input.getAll(key) : (input[key] ?? []);
  return (Array.isArray(values) ? values : [values]).filter(
    (value) => value instanceof File && value.size > 0,
  );
}

function hasValidEmailShape(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateFeedbackImages(images) {
  const errors = {};

  if (images.length > MAX_FEEDBACK_IMAGE_COUNT) {
    errors.images = `Attach up to ${MAX_FEEDBACK_IMAGE_COUNT} images`;
    return errors;
  }

  let totalBytes = 0;
  for (const image of images) {
    totalBytes += image.size;

    if (!IMAGE_TYPES.has(image.type)) {
      errors.images = "Upload JPEG, PNG, or WebP images";
      return errors;
    }
  }

  if (totalBytes > MAX_FEEDBACK_IMAGE_TOTAL_BYTES) {
    errors.images = "Images must be 10 MB total or smaller";
  }

  return errors;
}

export function sanitizeFeedbackFilename(name, index = 0) {
  const fallback = `feedback-image-${index + 1}.jpg`;
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) return fallback;

  const sanitized = trimmed
    .replace(/[/\\]/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/^-+/, "")
    .slice(0, 100);

  return sanitized || fallback;
}

export function parseFeedbackForm(input) {
  const data = {
    name: getValue(input, "name"),
    email: getValue(input, "email").toLowerCase(),
    message: getValue(input, "message"),
    images: getFiles(input, "images"),
    website: getValue(input, "website"),
  };
  const errors = {};

  if (!data.message) {
    errors.message = "Required";
  } else if (data.message.length > MAX_FEEDBACK_MESSAGE_LENGTH) {
    errors.message = "Too long";
  }

  if (data.name.length > MAX_FEEDBACK_NAME_LENGTH) {
    errors.name = "Too long";
  }

  if (data.email && !hasValidEmailShape(data.email)) {
    errors.email = "Enter a valid email";
  }

  Object.assign(errors, validateFeedbackImages(data.images));

  if (Object.keys(errors).length > 0) {
    return { ok: false, data, errors };
  }

  return { ok: true, data, errors: {} };
}
