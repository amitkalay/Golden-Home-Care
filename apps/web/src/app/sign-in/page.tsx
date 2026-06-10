import { Home } from "lucide-react";
import Link from "next/link";
import { getSearchParamValue, normalizeCallbackUrl } from "../lib/auth-url";
import { EmailSignInForm } from "./email-sign-in-form";
import { GoogleSignInButton } from "./google-sign-in-button";

type SignInPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string | string[];
    error?: string | string[];
    status?: string | string[];
  }>;
};

function getAuthErrorMessage(error?: string) {
  if (!error) return null;

  if (error === "CredentialsSignin") {
    return "Check your email and password, then try again.";
  }

  if (error === "AccessDenied") {
    return "Google sign-in requires a verified Google email address.";
  }

  return "Sign-in could not start. Check the auth environment variables and try again.";
}

function getStatusMessage(status?: string) {
  if (status === "verified") {
    return "Your email is verified. Sign in with your password.";
  }

  if (status === "password-reset") {
    return "Your password has been reset. Sign in with your new password.";
  }

  return null;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = searchParams ? await searchParams : {};
  const error = getSearchParamValue(params.error);
  const status = getSearchParamValue(params.status);
  const callbackUrlParam = getSearchParamValue(params.callbackUrl);
  const callbackUrl = normalizeCallbackUrl(callbackUrlParam);
  const errorMessage = getAuthErrorMessage(error);
  const statusMessage = getStatusMessage(status);
  const signUpHref = callbackUrl === "/" ? "/sign-up" : `/sign-up?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <main className="auth-shell">
      <Link className="brand auth-brand" href="/">
        <span className="brand-mark">
          <Home size={34} strokeWidth={1.6} />
        </span>
        <span>Golden Home Care</span>
      </Link>
      <section className="auth-card">
        <h1>Sign in</h1>
        <p>Use your email and password, or continue with Google.</p>
        {statusMessage ? (
          <p className="form-alert success" role="status">
            {statusMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="form-alert error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <EmailSignInForm callbackUrl={callbackUrl} />
        <div className="auth-links">
          <Link href={signUpHref}>Create an account</Link>
          <Link href="/forgot-password">Forgot password?</Link>
        </div>
        <div className="auth-divider" aria-hidden="true">
          <span>or</span>
        </div>
        <GoogleSignInButton callbackUrl={callbackUrl} className="button button-outline auth-button" />
      </section>
    </main>
  );
}
