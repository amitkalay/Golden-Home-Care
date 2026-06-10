import { Home } from "lucide-react";
import Link from "next/link";
import { getSearchParamValue, normalizeCallbackUrl } from "../lib/auth-url";
import { requestPasswordSignupAction } from "./actions";

type SignUpPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string | string[];
    status?: string | string[];
  }>;
};

function getStatusMessage(status?: string) {
  if (status === "check-email") {
    return {
      className: "form-alert success",
      copy: "Check your email for the verification link to finish creating your account.",
      role: "status",
    };
  }

  if (status === "invalid") {
    return {
      className: "form-alert error",
      copy: "Enter your name, a valid email, and matching passwords with at least 8 characters.",
      role: "alert",
    };
  }

  if (status === "error") {
    return {
      className: "form-alert error",
      copy: "We could not send the verification email. Check the email environment variables and try again.",
      role: "alert",
    };
  }

  return null;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = searchParams ? await searchParams : {};
  const callbackUrl = normalizeCallbackUrl(getSearchParamValue(params.callbackUrl));
  const status = getSearchParamValue(params.status);
  const statusMessage = getStatusMessage(status);
  const signInHref = callbackUrl === "/" ? "/sign-in" : `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <main className="auth-shell">
      <Link className="brand auth-brand" href="/">
        <span className="brand-mark">
          <Home size={34} strokeWidth={1.6} />
        </span>
        <span>Golden Home Care</span>
      </Link>
      <section className="auth-card">
        <h1>Create account</h1>
        <p>Use email and password to create a verified Golden Home Care account.</p>
        {statusMessage ? (
          <p className={statusMessage.className} role={statusMessage.role}>
            {statusMessage.copy}
          </p>
        ) : null}
        <form className="auth-form" action={requestPasswordSignupAction}>
          <input name="callbackUrl" type="hidden" value={callbackUrl} />
          <label>
            Name
            <input name="name" type="text" autoComplete="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
          </label>
          <label>
            Confirm password
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
            Create account
          </button>
        </form>
        <p className="auth-footnote">
          Already have an account? <Link href={signInHref}>Sign in</Link>
        </p>
      </section>
    </main>
  );
}
