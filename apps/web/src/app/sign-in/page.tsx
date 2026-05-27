import { Home } from "lucide-react";
import Link from "next/link";
import { GoogleSignInButton } from "./google-sign-in-button";

const authErrorMessage =
  "Google sign-in could not start. Check the OAuth environment variables and try again.";

type SignInPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string | string[];
    error?: string | string[];
  }>;
};

function normalizeCallbackUrl(callbackUrl?: string) {
  if (!callbackUrl?.startsWith("/") || callbackUrl.startsWith("//")) {
    return "/";
  }

  return callbackUrl === "/provider" ? "/" : callbackUrl;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = searchParams ? await searchParams : {};
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const callbackUrlParam = Array.isArray(params.callbackUrl) ? params.callbackUrl[0] : params.callbackUrl;
  const callbackUrl = normalizeCallbackUrl(callbackUrlParam);

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
        <p>Sign in with Google to manage your Golden Home Care account.</p>
        {error ? (
          <p className="form-alert error" role="alert">
            {authErrorMessage}
          </p>
        ) : null}
        <GoogleSignInButton callbackUrl={callbackUrl} />
      </section>
    </main>
  );
}
