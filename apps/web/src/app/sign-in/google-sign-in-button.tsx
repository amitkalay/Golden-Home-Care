"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { signIn } from "next-auth/react";

export function GoogleSignInButton({
  callbackUrl = "/account",
  label = "Continue with Google",
  className = "button button-primary auth-button",
}: {
  callbackUrl?: string;
  label?: string;
  className?: string;
}) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <button
      className={className}
      disabled={isLoading}
      onClick={() => {
        setIsLoading(true);
        void signIn("google", { callbackUrl }).finally(() => {
          setIsLoading(false);
        });
      }}
      type="button"
    >
      <LogIn size={18} />
      {isLoading ? "Opening Google..." : label}
    </button>
  );
}
