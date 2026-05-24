import Link from "next/link";
import { HandHeart, Home, MessageCircle } from "lucide-react";
import { sendFeedback } from "./actions";
import { FeedbackSubmitButton } from "./submit-button";

type FeedbackPageProps = {
  searchParams?: Promise<{
    status?: string | string[];
  }>;
};

function getFeedbackAlert(status?: string | string[]) {
  const value = Array.isArray(status) ? status[0] : status;

  if (value === "sent") {
    return {
      className: "form-alert success full",
      copy: "Thanks for the feedback. It was sent directly to Amit.",
      role: "status",
    };
  }

  if (value === "invalid") {
    return {
      className: "form-alert error full",
      copy: "Please enter feedback text and attach up to 3 JPEG, PNG, or WebP images under 10 MB total.",
      role: "alert",
    };
  }

  if (value === "error") {
    return {
      className: "form-alert error full",
      copy: "We could not send your feedback. Please try again in a moment.",
      role: "alert",
    };
  }

  return null;
}

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const params = searchParams ? await searchParams : {};
  const feedbackAlert = getFeedbackAlert(params.status);

  return (
    <main className="feedback-page">
      <Link className="brand feedback-page-brand" href="/" aria-label="Golden Home Care home">
        <span className="brand-mark">
          <Home size={31} strokeWidth={1.6} />
          <HandHeart size={25} strokeWidth={1.5} />
        </span>
        <span>Golden Home Care</span>
      </Link>

      <section className="feedback-page-header">
        <span>
          <MessageCircle size={18} /> Got Feedback
        </span>
        <h1>Tell us what would make Golden Home Care better.</h1>
        <p>
          Send a note, screenshot, or photo. Every message goes straight to the team so we can keep improving the
          experience for families and providers.
        </p>
      </section>

      <form className="form-card feedback-form feedback-page-form" action={sendFeedback}>
        {feedbackAlert ? (
          <p className={feedbackAlert.className} role={feedbackAlert.role}>
            {feedbackAlert.copy}
          </p>
        ) : null}
        <label>
          Name <span>optional</span>
          <input autoComplete="name" maxLength={120} name="name" placeholder="Your name" type="text" />
        </label>
        <label>
          Email <span>optional</span>
          <input autoComplete="email" name="email" placeholder="you@example.com" type="email" />
        </label>
        <label className="full">
          Feedback
          <textarea
            maxLength={3000}
            name="message"
            placeholder="What is working, what is confusing, or what should we add?"
            required
          />
        </label>
        <label className="feedback-file-label full">
          Images <span>optional</span>
          <input accept="image/jpeg,image/png,image/webp" multiple name="images" type="file" />
          <small>Up to 3 images, 10 MB total.</small>
        </label>
        <label className="feedback-honeypot" aria-hidden="true">
          Website
          <input autoComplete="off" name="website" tabIndex={-1} type="text" />
        </label>
        <FeedbackSubmitButton />
      </form>
    </main>
  );
}
