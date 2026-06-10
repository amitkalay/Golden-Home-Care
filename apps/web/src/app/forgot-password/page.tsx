import { Home } from "lucide-react";
import Link from "next/link";
import { getSearchParamValue } from "../lib/auth-url";
import { requestPasswordResetAction } from "./actions";

type ForgotPasswordPageProps = {
  searchParams?: Promise<{
    status?: string | string[];
  }>;
};

function getStatusMessage(status?: string) {
  if (status === "sent") {
    return {
      className: "form-alert success",
      copy: "If that email can sign in, we sent instructions for the next step.",
      role: "status",
    };
  }

  if (status === "invalid") {
    return {
      className: "form-alert error",
      copy: "Enter a valid email address.",
      role: "alert",
    };
  }

  if (status === "error") {
    return {
      className: "form-alert error",
      copy: "We could not send password reset email. Check the email environment variables and try again.",
      role: "alert",
    };
  }

  return null;
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = searchParams ? await searchParams : {};
  const statusMessage = getStatusMessage(getSearchParamValue(params.status));

  return (
    <main className="auth-shell">
      <Link className="brand auth-brand" href="/">
        <span className="brand-mark">
          <Home size={34} strokeWidth={1.6} />
        </span>
        <span>Golden Home Care</span>
      </Link>
      <section className="auth-card">
        <h1>Reset password</h1>
        <p>Enter your email and we will send a secure reset link if the account uses a password.</p>
        {statusMessage ? (
          <p className={statusMessage.className} role={statusMessage.role}>
            {statusMessage.copy}
          </p>
        ) : null}
        <form className="auth-form" action={requestPasswordResetAction}>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <button className="button button-primary auth-button" type="submit">
            Send reset link
          </button>
        </form>
        <p className="auth-footnote">
          Remembered it? <Link href="/sign-in">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
