import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_FEEDBACK_IMAGE_TOTAL_BYTES,
  parseFeedbackForm,
  sanitizeFeedbackFilename,
} from "../src/app/feedback/validation.js";

function validForm(overrides = {}) {
  const form = new FormData();
  const values = {
    name: "Amit",
    email: "AMIT@example.com",
    message: "This page looks good, but the form could use more contrast.",
    images: [new File(["screenshot"], "screen shot.png", { type: "image/png" })],
    ...overrides,
  };

  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      for (const item of value) form.append(key, item);
    } else {
      form.set(key, value);
    }
  }

  return form;
}

describe("feedback validation", () => {
  it("accepts valid feedback with optional contact and images", () => {
    const result = parseFeedbackForm(validForm());

    assert.equal(result.ok, true);
    assert.equal(result.data.name, "Amit");
    assert.equal(result.data.email, "amit@example.com");
    assert.equal(result.data.message, "This page looks good, but the form could use more contrast.");
    assert.equal(result.data.images.length, 1);
  });

  it("rejects missing feedback text", () => {
    const result = parseFeedbackForm(validForm({ message: "" }));

    assert.equal(result.ok, false);
    assert.equal(result.errors.message, "Required");
  });

  it("rejects invalid optional email", () => {
    const result = parseFeedbackForm(validForm({ email: "amit" }));

    assert.equal(result.ok, false);
    assert.equal(result.errors.email, "Enter a valid email");
  });

  it("rejects unsupported image types", () => {
    const result = parseFeedbackForm(
      validForm({ images: [new File(["gif"], "animation.gif", { type: "image/gif" })] }),
    );

    assert.equal(result.ok, false);
    assert.equal(result.errors.images, "Upload JPEG, PNG, or WebP images");
  });

  it("rejects more than 3 images", () => {
    const images = Array.from(
      { length: 4 },
      (_, index) => new File(["x"], `feedback-${index}.png`, { type: "image/png" }),
    );
    const result = parseFeedbackForm(validForm({ images }));

    assert.equal(result.ok, false);
    assert.equal(result.errors.images, "Attach up to 3 images");
  });

  it("rejects images over the 10 MB total limit", () => {
    const result = parseFeedbackForm(
      validForm({
        images: [
          new File([new Uint8Array(MAX_FEEDBACK_IMAGE_TOTAL_BYTES + 1)], "large.png", {
            type: "image/png",
          }),
        ],
      }),
    );

    assert.equal(result.ok, false);
    assert.equal(result.errors.images, "Images must be 10 MB total or smaller");
  });

  it("sanitizes attachment filenames", () => {
    assert.equal(sanitizeFeedbackFilename("../screen shot!.png"), "screen-shot-.png");
    assert.equal(sanitizeFeedbackFilename("", 1), "feedback-image-2.jpg");
  });
});
