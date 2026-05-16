import { Home } from "lucide-react";
import Link from "next/link";
import { GoogleSignInButton } from "./google-sign-in-button";

const authErrorMessage =
  "Google sign-in could not start. Check the OAuth environment variables and try again.";

type SignInPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = searchParams ? await searchParams : {};
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <main className="auth-shell">
      <Link className="brand auth-brand" href="/">
        <span className="brand-mark">
          <Home size={34} strokeWidth={1.6} />
        </span>
        <span>Golden Home Care</span>
      </Link>
      <section className="auth-card">
        <h1>Provider sign in</h1>
        <p>Sign in with Google to create and manage your Golden Home Care provider profile.</p>
        {error ? (
          <p className="form-alert error" role="alert">
            {authErrorMessage}
          </p>
        ) : null}
        <GoogleSignInButton />
      </section>
    </main>
  );
}
