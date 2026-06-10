import { Home } from "lucide-react";
import Link from "next/link";
import { getSearchParamValue } from "../lib/auth-url";
import { isPasswordResetTokenValid } from "../lib/password-accounts";
import { resetPasswordAction } from "./actions";

export const dynamic = "force-dynamic";

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    token?: string | string[];
    status?: string | string[];
  }>;
};

function getStatusMessage(status?: string) {
  if (status === "invalid") {
    return {
      className: "form-alert error",
      copy: "Enter matching passwords with at least 8 characters.",
      role: "alert",
    };
  }

  if (status === "expired") {
    return {
      className: "form-alert error",
      copy: "That reset link has expired. Request a new one.",
      role: "alert",
    };
  }

  if (status === "error") {
    return {
      className: "form-alert error",
      copy: "We could not reset your password. Try requesting a new link.",
      role: "alert",
    };
  }

  return null;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = searchParams ? await searchParams : {};
  const token = getSearchParamValue(params.token) ?? "";
  const status = getSearchParamValue(params.status);
  const statusMessage = getStatusMessage(status);
  const tokenIsValid = token ? await isPasswordResetTokenValid(token) : false;

  return (
    <main className="auth-shell">
      <Link className="brand auth-brand" href="/">
        <span className="brand-mark">
          <Home size={34} strokeWidth={1.6} />
        </span>
        <span>Golden Home Care</span>
      </Link>
      <section className="auth-card">
        <h1>Choose new password</h1>
        {statusMessage ? (
          <p className={statusMessage.className} role={statusMessage.role}>
            {statusMessage.copy}
          </p>
        ) : null}
        {tokenIsValid ? (
          <>
            <p>Use a new password for your Golden Home Care account.</p>
            <form className="auth-form" action={resetPasswordAction}>
              <input name="token" type="hidden" value={token} />
              <label>
                New password
                <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
              </label>
              <label>
                Confirm new password
                <input
                  name="passwordConfirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                />
              </label>
              <button className="button button-primary auth-button" type="submit">
                Reset password
              </button>
            </form>
          </>
        ) : (
          <>
            <p>This reset link is invalid or expired.</p>
            <Link className="button button-primary auth-button" href="/forgot-password">
              Request a new link
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
