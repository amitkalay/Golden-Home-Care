import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const VERIFICATION_TOKEN_HOURS = 24;
export const RESET_TOKEN_HOURS = 1;

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};

function getValue(input, key) {
  const value = typeof input?.get === "function" ? input.get(key) : (input?.[key] ?? "");
  return typeof value === "string" ? value.trim() : "";
}

function getRawValue(input, key) {
  const value = typeof input?.get === "function" ? input.get(key) : (input?.[key] ?? "");
  return typeof value === "string" ? value : "";
}

export function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function isValidEmail(value) {
  const email = normalizeEmail(value);
  return email.length > 3 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePasswordFields(password, passwordConfirmation = password) {
  const errors = {};

  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters`;
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Use ${PASSWORD_MAX_LENGTH} characters or fewer`;
  }

  if (password !== passwordConfirmation) {
    errors.passwordConfirmation = "Passwords must match";
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}

export function parseSignupForm(input) {
  const data = {
    name: getValue(input, "name"),
    email: normalizeEmail(getValue(input, "email")),
    password: getRawValue(input, "password"),
    passwordConfirmation: getRawValue(input, "passwordConfirmation"),
  };
  const errors = {};
  const passwordResult = validatePasswordFields(data.password, data.passwordConfirmation);

  if (!data.name || data.name.length > 120) {
    errors.name = "Enter your name";
  }

  if (!isValidEmail(data.email)) {
    errors.email = "Enter a valid email address";
  }

  Object.assign(errors, passwordResult.errors);

  return {
    ok: Object.keys(errors).length === 0,
    data,
    errors,
  };
}

export function parseEmailForm(input) {
  const data = {
    email: normalizeEmail(getValue(input, "email")),
  };
  const errors = {};

  if (!isValidEmail(data.email)) {
    errors.email = "Enter a valid email address";
  }

  return {
    ok: Object.keys(errors).length === 0,
    data,
    errors,
  };
}

export function parseResetPasswordForm(input) {
  const data = {
    token: getValue(input, "token"),
    password: getRawValue(input, "password"),
    passwordConfirmation: getRawValue(input, "passwordConfirmation"),
  };
  const passwordResult = validatePasswordFields(data.password, data.passwordConfirmation);

  return {
    ok: Boolean(data.token) && passwordResult.ok,
    data,
    errors: {
      ...passwordResult.errors,
      ...(data.token ? {} : { token: "Missing reset token" }),
    },
  };
}

export function createAuthToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function getVerificationExpiry(now = new Date()) {
  return new Date(now.getTime() + VERIFICATION_TOKEN_HOURS * 60 * 60 * 1000);
}

export function getResetExpiry(now = new Date()) {
  return new Date(now.getTime() + RESET_TOKEN_HOURS * 60 * 60 * 1000);
}

export function isExpired(expiresAt, now = new Date()) {
  return new Date(expiresAt).getTime() <= now.getTime();
}

function encodeScryptParams(params) {
  return `N=${params.N},r=${params.r},p=${params.p}`;
}

function decodeScryptParams(value) {
  const params = Object.fromEntries(
    value.split(",").map((item) => {
      const [key, rawValue] = item.split("=");
      return [key, Number.parseInt(rawValue, 10)];
    }),
  );

  if (!params.N || !params.r || !params.p) {
    return null;
  }

  return {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: SCRYPT_PARAMS.maxmem,
  };
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = await scrypt(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_PARAMS);

  return `scrypt$${encodeScryptParams(SCRYPT_PARAMS)}$${salt}$${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password, storedHash) {
  const [scheme, encodedParams, salt, encodedHash] = String(storedHash ?? "").split("$");

  if (scheme !== "scrypt" || !encodedParams || !salt || !encodedHash) {
    return false;
  }

  const params = decodeScryptParams(encodedParams);
  if (!params) {
    return false;
  }

  const expectedHash = Buffer.from(encodedHash, "base64url");
  const derivedKey = await scrypt(password, salt, expectedHash.length, params);

  if (derivedKey.length !== expectedHash.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expectedHash);
}
