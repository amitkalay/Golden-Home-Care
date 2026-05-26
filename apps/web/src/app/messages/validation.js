export const MAX_MESSAGE_BODY_LENGTH = 1000;

function getValue(input, name) {
  if (input instanceof FormData) {
    return String(input.get(name) ?? "").trim();
  }

  if (input && typeof input === "object") {
    return String(input[name] ?? "").trim();
  }

  return "";
}

export function parseMessageBody(input) {
  const body = getValue(input, "body");
  const errors = {};

  if (!body) {
    errors.body = "Required";
  } else if (body.length > MAX_MESSAGE_BODY_LENGTH) {
    errors.body = "Too long";
  }

  if (Object.keys(errors).length) {
    return { ok: false, errors, data: { body } };
  }

  return { ok: true, data: { body } };
}
