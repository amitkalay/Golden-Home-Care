import { Home } from "lucide-react";
import Link from "next/link";
import { buildAuthStatusHref, getSearchParamValue, normalizeCallbackUrl } from "../lib/auth-url";
import { verifyPendingPasswordSignup } from "../lib/password-accounts";
import type { VerifySignupResult } from "../lib/password-accounts";

export const dynamic = "force-dynamic";

type VerifyEmailPageProps = {
  searchParams?: Promise<{
    token?: string | string[];
    callbackUrl?: string | string[];
  }>;
};

function getResultMessage(result: VerifySignupResult) {
  if (result === "verified") {
    return {
      className: "form-alert success",
      copy: "Your email is verified. Sign in with your password to continue.",
      role: "status",
      signInStatus: "verified",
    };
  }

  if (result === "expired") {
    return {
      className: "form-alert error",
      copy: "That verification link has expired. Create the account again to receive a fresh link.",
      role: "alert",
      signInStatus: "error",
    };
  }

  if (result === "already-password") {
    return {
      className: "form-alert success",
      copy: "That email already has a password account. Sign in to continue.",
      role: "status",
      signInStatus: "verified",
    };
  }

  if (result === "google-only") {
    return {
      className: "form-alert success",
      copy: "That email is already connected to a Google sign-in account. Continue with Google.",
      role: "status",
      signInStatus: "verified",
    };
  }

  return {
    className: "form-alert error",
    copy: "That verification link is invalid. Create the account again to receive a fresh link.",
    role: "alert",
    signInStatus: "error",
  };
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = searchParams ? await searchParams : {};
  const token = getSearchParamValue(params.token) ?? "";
  const callbackUrl = normalizeCallbackUrl(getSearchParamValue(params.callbackUrl));
  const result = token ? await verifyPendingPasswordSignup(token) : "invalid";
  const message = getResultMessage(result);
  const signInHref = buildAuthStatusHref("/sign-in", message.signInStatus, callbackUrl);

  return (
    <main className="auth-shell">
      <Link className="brand auth-brand" href="/">
        <span className="brand-mark">
          <Home size={34} strokeWidth={1.6} />
        </span>
        <span>Golden Home Care</span>
      </Link>
      <section className="auth-card">
        <h1>Email verification</h1>
        <p className={message.className} role={message.role}>
          {message.copy}
        </p>
        <Link className="button button-primary auth-button" href={signInHref}>
          Go to sign in
        </Link>
      </section>
    </main>
  );
}
