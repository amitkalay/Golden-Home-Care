"use server";

import { redirect } from "next/navigation";
import { Resend } from "resend";
import {
  FEEDBACK_RECIPIENT_EMAIL,
  parseFeedbackForm,
  sanitizeFeedbackFilename,
} from "./validation.js";

type ParsedFeedback = ReturnType<typeof parseFeedbackForm>["data"];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildFeedbackEmailText(feedback: ParsedFeedback) {
  const contactLines = [
    `Name: ${feedback.name || "Not provided"}`,
    `Email: ${feedback.email || "Not provided"}`,
    `Attachments: ${feedback.images.length}`,
  ];

  return [
    "New Golden Home Care landing page feedback",
    "",
    ...contactLines,
    "",
    "Message:",
    feedback.message,
  ].join("\n");
}

function buildFeedbackEmailHtml(feedback: ParsedFeedback) {
  const contactEmail = feedback.email
    ? `<a href="mailto:${escapeHtml(feedback.email)}">${escapeHtml(feedback.email)}</a>`
    : "Not provided";

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2824;">
      <h1 style="font-size:22px;color:#1f5744;">New landing page feedback</h1>
      <dl>
        <dt style="font-weight:700;">Name</dt>
        <dd style="margin:0 0 12px;">${escapeHtml(feedback.name || "Not provided")}</dd>
        <dt style="font-weight:700;">Email</dt>
        <dd style="margin:0 0 12px;">${contactEmail}</dd>
        <dt style="font-weight:700;">Attachments</dt>
        <dd style="margin:0 0 12px;">${feedback.images.length}</dd>
      </dl>
      <h2 style="font-size:16px;color:#1f5744;">Message</h2>
      <p style="white-space:pre-wrap;">${escapeHtml(feedback.message)}</p>
    </div>
  `;
}

async function buildFeedbackAttachments(images: File[]) {
  return Promise.all(
    images.map(async (image, index) => ({
      content: Buffer.from(await image.arrayBuffer()),
      filename: sanitizeFeedbackFilename(image.name, index),
      contentType: image.type,
    })),
  );
}

export async function sendFeedback(formData: FormData) {
  const result = parseFeedbackForm(formData);

  if (result.data.website) {
    redirect("/feedback?status=sent");
  }

  if (!result.ok) {
    redirect("/feedback?status=invalid");
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATIONS_FROM_EMAIL;

  if (!apiKey || !from) {
    console.error("Feedback email skipped because Resend environment variables are missing");
    redirect("/feedback?status=error");
  }

  try {
    const resend = new Resend(apiKey);
    const attachments = await buildFeedbackAttachments(result.data.images);
    const { error } = await resend.emails.send({
      from,
      to: FEEDBACK_RECIPIENT_EMAIL,
      subject: "Golden Home Care landing page feedback",
      html: buildFeedbackEmailHtml(result.data),
      text: buildFeedbackEmailText(result.data),
      replyTo: result.data.email || undefined,
      attachments,
    });

    if (error) {
      throw new Error(error.message || "Resend feedback email failed");
    }
  } catch (error) {
    console.error("Failed to send feedback email", error);
    redirect("/feedback?status=error");
  }

  redirect("/feedback?status=sent");
}
