"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function SignOutButton({
  className = "button button-outline",
}: {
  className?: string;
}) {
  return (
    <button
      className={className}
      onClick={() => {
        void signOut({ callbackUrl: "/" });
      }}
      type="button"
    >
      <LogOut size={16} />
      Sign out
    </button>
  );
}
