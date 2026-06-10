import { Resend } from "resend";
import { ensureAuthTables, getPool, getSql } from "./database";
import {
  createAuthToken,
  getResetExpiry,
  getVerificationExpiry,
  hashPassword,
  hashToken,
  isExpired,
  isValidEmail,
  normalizeEmail,
  verifyPassword,
} from "./password-security.js";

type UserRole = "user" | "provider";

type ExistingUserLogin = {
  id: string;
  name: string | null;
  email: string;
  hasPassword: boolean;
};

type PasswordUserRecord = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: UserRole;
  emailVerified: Date | null;
  passwordHash: string;
};

export type VerifySignupResult = "verified" | "expired" | "invalid" | "already-password" | "google-only";
export type ResetPasswordResult = "reset" | "expired" | "invalid";

function normalizeRole(role: unknown): UserRole {
  return role === "provider" ? "provider" : "user";
}

function toExistingUserLogin(row: Record<string, unknown>): ExistingUserLogin {
  return {
    id: String(row.id),
    name: (row.name as string | null) ?? null,
    email: String(row.email),
    hasPassword: Boolean(row.hasPassword),
  };
}

function toPasswordUserRecord(row: Record<string, unknown>): PasswordUserRecord {
  return {
    id: String(row.id),
    name: (row.name as string | null) ?? null,
    email: String(row.email),
    image: (row.image as string | null) ?? null,
    role: normalizeRole(row.role),
    emailVerified: (row.emailVerified as Date | null) ?? null,
    passwordHash: String(row.passwordHash),
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getAppBaseUrl() {
  const configuredUrl =
    process.env.APP_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  return configuredUrl.replace(/\/$/, "");
}

function getAuthEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATIONS_FROM_EMAIL;
  const baseUrl = getAppBaseUrl();

  if (!apiKey || !from || !baseUrl) {
    throw new Error(
      "Auth email is not configured. Set RESEND_API_KEY, NOTIFICATIONS_FROM_EMAIL, and APP_BASE_URL or NEXTAUTH_URL.",
    );
  }

  return { apiKey, from, baseUrl };
}

function buildUrl(path: string, baseUrl: string) {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function sendAuthEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const { apiKey, from } = getAuthEmailConfig();
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(error.message || "Auth email failed");
  }
}

async function getExistingUserLogin(email: string) {
  const sql = getSql();

  await ensureAuthTables();
  const rows = await sql`
    SELECT
      u.id,
      u.name,
      u.email,
      up.user_id IS NOT NULL as "hasPassword"
    FROM users u
    LEFT JOIN user_passwords up ON up.user_id = u.id
    WHERE lower(u.email) = ${email}
    LIMIT 1
  `;
  const records = rows as Array<Record<string, unknown>>;

  return records[0] ? toExistingUserLogin(records[0]) : null;
}

async function sendSignupVerificationEmail(email: string, name: string, token: string, callbackUrl: string) {
  const { baseUrl } = getAuthEmailConfig();
  const params = new URLSearchParams({ token });

  if (callbackUrl !== "/") {
    params.set("callbackUrl", callbackUrl);
  }

  const verifyUrl = buildUrl(`/verify-email?${params.toString()}`, baseUrl);
  const escapedName = escapeHtml(name);
  const escapedUrl = escapeHtml(verifyUrl);

  await sendAuthEmail({
    to: email,
    subject: "Verify your Golden Home Care account",
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#25332f;">
        <h1 style="font-size:22px;color:#1f5744;">Verify your account</h1>
        <p>Hello ${escapedName},</p>
        <p>Confirm your email address to finish creating your Golden Home Care account.</p>
        <p><a href="${escapedUrl}" style="color:#1f5744;font-weight:700;">Verify email address</a></p>
        <p>This link expires in 24 hours.</p>
      </div>
    `,
    text: `Hello ${name},\n\nConfirm your email address to finish creating your Golden Home Care account:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
  });
}

async function sendExistingAccountEmail(user: ExistingUserLogin) {
  const { baseUrl } = getAuthEmailConfig();
  const signInUrl = buildUrl("/sign-in", baseUrl);
  const resetUrl = buildUrl("/forgot-password", baseUrl);
  const escapedSignInUrl = escapeHtml(signInUrl);
  const escapedResetUrl = escapeHtml(resetUrl);

  if (user.hasPassword) {
    await sendAuthEmail({
      to: user.email,
      subject: "Your Golden Home Care account already exists",
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#25332f;">
          <h1 style="font-size:22px;color:#1f5744;">Account already exists</h1>
          <p>This email address already has a Golden Home Care password account.</p>
          <p><a href="${escapedSignInUrl}" style="color:#1f5744;font-weight:700;">Sign in</a></p>
          <p>If you forgot your password, use <a href="${escapedResetUrl}" style="color:#1f5744;font-weight:700;">password reset</a>.</p>
        </div>
      `,
      text: `This email address already has a Golden Home Care password account.\n\nSign in: ${signInUrl}\nReset password: ${resetUrl}`,
    });
    return;
  }

  await sendAuthEmail({
    to: user.email,
    subject: "Use Google to access Golden Home Care",
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#25332f;">
        <h1 style="font-size:22px;color:#1f5744;">Use Google sign-in</h1>
        <p>This email address is connected to a Golden Home Care account that signs in with Google.</p>
        <p><a href="${escapedSignInUrl}" style="color:#1f5744;font-weight:700;">Continue with Google</a></p>
      </div>
    `,
    text: `This email address is connected to a Golden Home Care account that signs in with Google.\n\nContinue with Google: ${signInUrl}`,
  });
}

async function sendPasswordResetEmail(email: string, token: string) {
  const { baseUrl } = getAuthEmailConfig();
  const resetUrl = buildUrl(`/reset-password?${new URLSearchParams({ token }).toString()}`, baseUrl);
  const escapedResetUrl = escapeHtml(resetUrl);

  await sendAuthEmail({
    to: email,
    subject: "Reset your Golden Home Care password",
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#25332f;">
        <h1 style="font-size:22px;color:#1f5744;">Reset your password</h1>
        <p>Use this secure link to choose a new Golden Home Care password.</p>
        <p><a href="${escapedResetUrl}" style="color:#1f5744;font-weight:700;">Reset password</a></p>
        <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
      </div>
    `,
    text: `Use this secure link to choose a new Golden Home Care password:\n${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this email.`,
  });
}

async function sendGoogleOnlyResetEmail(email: string) {
  const { baseUrl } = getAuthEmailConfig();
  const signInUrl = buildUrl("/sign-in", baseUrl);
  const escapedSignInUrl = escapeHtml(signInUrl);

  await sendAuthEmail({
    to: email,
    subject: "Use Google to sign in to Golden Home Care",
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#25332f;">
        <h1 style="font-size:22px;color:#1f5744;">Use Google sign-in</h1>
        <p>Your Golden Home Care account uses Google sign-in and does not have a password to reset.</p>
        <p><a href="${escapedSignInUrl}" style="color:#1f5744;font-weight:700;">Continue with Google</a></p>
      </div>
    `,
    text: `Your Golden Home Care account uses Google sign-in and does not have a password to reset.\n\nContinue with Google: ${signInUrl}`,
  });
}

export async function requestPasswordSignup({
  name,
  email,
  password,
  callbackUrl,
}: {
  name: string;
  email: string;
  password: string;
  callbackUrl: string;
}) {
  const normalizedEmail = normalizeEmail(email);

  getAuthEmailConfig();
  const existingUser = await getExistingUserLogin(normalizedEmail);
  if (existingUser) {
    await sendExistingAccountEmail(existingUser);
    return;
  }

  const token = createAuthToken();
  const passwordHash = await hashPassword(password);
  const tokenHash = hashToken(token);
  const expiresAt = getVerificationExpiry();
  const sql = getSql();

  await ensureAuthTables();
  await sql`
    INSERT INTO pending_password_signups (
      email,
      name,
      password_hash,
      verification_token_hash,
      expires_at
    )
    VALUES (
      ${normalizedEmail},
      ${name},
      ${passwordHash},
      ${tokenHash},
      ${expiresAt}
    )
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      password_hash = EXCLUDED.password_hash,
      verification_token_hash = EXCLUDED.verification_token_hash,
      expires_at = EXCLUDED.expires_at,
      updated_at = now()
  `;

  await sendSignupVerificationEmail(normalizedEmail, name, token, callbackUrl);
}

export async function verifyPendingPasswordSignup(tokenInput: string): Promise<VerifySignupResult> {
  const token = String(tokenInput ?? "").trim();
  if (!token) {
    return "invalid";
  }

  await ensureAuthTables();
  const client = await getPool().connect();
  const tokenHash = hashToken(token);

  try {
    await client.query("BEGIN");
    const pendingResult = await client.query(
      `
        SELECT email, name, password_hash, expires_at
        FROM pending_password_signups
        WHERE verification_token_hash = $1
        FOR UPDATE
      `,
      [tokenHash],
    );
    const pending = pendingResult.rows[0];

    if (!pending) {
      await client.query("ROLLBACK");
      return "invalid";
    }

    if (isExpired(pending.expires_at)) {
      await client.query("DELETE FROM pending_password_signups WHERE email = $1", [pending.email]);
      await client.query("COMMIT");
      return "expired";
    }

    const existingResult = await client.query(
      `
        SELECT u.id, up.user_id IS NOT NULL AS "hasPassword"
        FROM users u
        LEFT JOIN user_passwords up ON up.user_id = u.id
        WHERE lower(u.email) = $1
        LIMIT 1
        FOR UPDATE OF u
      `,
      [pending.email],
    );
    const existing = existingResult.rows[0];

    if (existing) {
      await client.query("DELETE FROM pending_password_signups WHERE email = $1", [pending.email]);
      await client.query("COMMIT");
      return existing.hasPassword ? "already-password" : "google-only";
    }

    const userResult = await client.query(
      `
        INSERT INTO users (name, email, "emailVerified", role, created_at, updated_at)
        VALUES ($1, $2, now(), 'user', now(), now())
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `,
      [pending.name, pending.email],
    );
    const userId = userResult.rows[0]?.id;

    if (!userId) {
      const conflictingUserResult = await client.query(
        `
          SELECT u.id, up.user_id IS NOT NULL AS "hasPassword"
          FROM users u
          LEFT JOIN user_passwords up ON up.user_id = u.id
          WHERE lower(u.email) = $1
          LIMIT 1
        `,
        [pending.email],
      );
      const conflictingUser = conflictingUserResult.rows[0];

      await client.query("DELETE FROM pending_password_signups WHERE email = $1", [pending.email]);
      await client.query("COMMIT");
      return conflictingUser?.hasPassword ? "already-password" : "google-only";
    }

    await client.query(
      `
        INSERT INTO user_passwords (user_id, password_hash)
        VALUES ($1, $2)
      `,
      [userId, pending.password_hash],
    );
    await client.query("DELETE FROM pending_password_signups WHERE email = $1", [pending.email]);
    await client.query("COMMIT");
    return "verified";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function authenticatePasswordUser(emailInput: unknown, passwordInput: unknown) {
  const email = normalizeEmail(emailInput);
  const password = typeof passwordInput === "string" ? passwordInput : "";

  if (!isValidEmail(email) || !password) {
    return null;
  }

  const sql = getSql();
  await ensureAuthTables();
  const rows = await sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.image,
      u.role,
      u."emailVerified" as "emailVerified",
      up.password_hash as "passwordHash"
    FROM users u
    JOIN user_passwords up ON up.user_id = u.id
    WHERE lower(u.email) = ${email}
    LIMIT 1
  `;
  const records = rows as Array<Record<string, unknown>>;

  if (!records[0]) {
    return null;
  }

  const user = toPasswordUserRecord(records[0]);
  if (!user.emailVerified) {
    return null;
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
  };
}

export async function requestPasswordReset(emailInput: string) {
  const email = normalizeEmail(emailInput);
  if (!isValidEmail(email)) {
    return;
  }

  getAuthEmailConfig();
  const existingUser = await getExistingUserLogin(email);
  if (!existingUser) {
    return;
  }

  if (!existingUser.hasPassword) {
    await sendGoogleOnlyResetEmail(existingUser.email);
    return;
  }

  const token = createAuthToken();
  const tokenHash = hashToken(token);
  const expiresAt = getResetExpiry();
  const sql = getSql();

  await ensureAuthTables();
  await sql`
    INSERT INTO password_reset_tokens (
      user_id,
      token_hash,
      expires_at
    )
    VALUES (
      ${existingUser.id},
      ${tokenHash},
      ${expiresAt}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      token_hash = EXCLUDED.token_hash,
      expires_at = EXCLUDED.expires_at,
      updated_at = now()
  `;

  await sendPasswordResetEmail(existingUser.email, token);
}

export async function isPasswordResetTokenValid(tokenInput: string) {
  const token = String(tokenInput ?? "").trim();
  if (!token) {
    return false;
  }

  const sql = getSql();
  await ensureAuthTables();
  const rows = await sql`
    SELECT expires_at
    FROM password_reset_tokens
    WHERE token_hash = ${hashToken(token)}
    LIMIT 1
  `;
  const records = rows as Array<Record<string, unknown>>;
  const expiresAt = records[0]?.expires_at;

  return Boolean(expiresAt && !isExpired(expiresAt as Date));
}

export async function resetPasswordWithToken(tokenInput: string, password: string): Promise<ResetPasswordResult> {
  const token = String(tokenInput ?? "").trim();
  if (!token) {
    return "invalid";
  }

  const passwordHash = await hashPassword(password);
  const tokenHash = hashToken(token);

  await ensureAuthTables();
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const tokenResult = await client.query(
      `
        SELECT user_id, expires_at
        FROM password_reset_tokens
        WHERE token_hash = $1
        FOR UPDATE
      `,
      [tokenHash],
    );
    const resetToken = tokenResult.rows[0];

    if (!resetToken) {
      await client.query("ROLLBACK");
      return "invalid";
    }

    if (isExpired(resetToken.expires_at)) {
      await client.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [resetToken.user_id]);
      await client.query("COMMIT");
      return "expired";
    }

    await client.query(
      `
        UPDATE user_passwords
        SET password_hash = $2, updated_at = now()
        WHERE user_id = $1
      `,
      [resetToken.user_id, passwordHash],
    );
    await client.query(
      `
        UPDATE users
        SET "emailVerified" = COALESCE("emailVerified", now()), updated_at = now()
        WHERE id = $1
      `,
      [resetToken.user_id],
    );
    await client.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [resetToken.user_id]);
    await client.query("COMMIT");
    return "reset";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function markGoogleEmailVerified(emailInput: unknown) {
  const email = normalizeEmail(emailInput);
  if (!isValidEmail(email)) {
    return;
  }

  const sql = getSql();
  await ensureAuthTables();
  await sql`
    UPDATE users
    SET
      "emailVerified" = COALESCE("emailVerified", now()),
      updated_at = now()
    WHERE lower(email) = ${email}
  `;
}

export async function getUserRole(userId: string) {
  const sql = getSql();

  await ensureAuthTables();
  const rows = await sql`
    SELECT role
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;
  const records = rows as Array<Record<string, unknown>>;

  return records[0] ? normalizeRole(records[0].role) : "user";
}
