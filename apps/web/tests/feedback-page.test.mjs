import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("feedback page source checks", () => {
  it("renders the standalone public feedback form", async () => {
    const page = await readFile(new URL("../src/app/feedback/page.tsx", import.meta.url), "utf8");

    assert.match(page, /export default async function FeedbackPage/);
    assert.match(page, /getFeedbackAlert/);
    assert.match(page, /params\.status/);
    assert.match(page, /action=\{sendFeedback\}/);
    assert.match(page, /name="message"/);
    assert.match(page, /name="images"/);
    assert.match(page, /multiple name="images" type="file"/);
    assert.match(page, /name="website"/);
    assert.match(page, /FeedbackSubmitButton/);
    assert.match(page, /Got Feedback/);
    assert.match(page, /href="\/"/);
  });
});
