"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { signIn } from "next-auth/react";

export function GoogleSignInButton() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <button
      className="button button-primary auth-button"
      disabled={isLoading}
      onClick={() => {
        setIsLoading(true);
        void signIn("google", { callbackUrl: "/provider/onboarding" }).finally(() => {
          setIsLoading(false);
        });
      }}
      type="button"
    >
      <LogIn size={18} />
      {isLoading ? "Opening Google..." : "Continue with Google"}
    </button>
  );
}

