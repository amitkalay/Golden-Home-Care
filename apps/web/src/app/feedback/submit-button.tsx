"use client";

import { Send } from "lucide-react";
import { useFormStatus } from "react-dom";

export function FeedbackSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button button-primary feedback-submit-button" disabled={pending} type="submit">
      <Send size={17} />
      {pending ? "Sending..." : "Send feedback"}
    </button>
  );
}
