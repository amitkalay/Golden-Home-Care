"use client";

import { FormEvent, useState } from "react";
import { Mail } from "lucide-react";
import { signIn } from "next-auth/react";

export function EmailSignInForm({ callbackUrl }: { callbackUrl: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      callbackUrl,
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error) {
      setError("Check your email and password, then try again.");
      return;
    }

    window.location.assign(result?.url || callbackUrl);
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {error ? (
        <p className="form-alert error" role="alert">
          {error}
        </p>
      ) : null}
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <button className="button button-primary auth-button" disabled={isLoading} type="submit">
        <Mail size={18} />
        {isLoading ? "Signing in..." : "Sign in with email"}
      </button>
    </form>
  );
}
