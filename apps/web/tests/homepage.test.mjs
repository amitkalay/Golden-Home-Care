import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("homepage", () => {
  it('includes the company name "Golden Home Care"', async () => {
    const homepage = await readFile(
      new URL("../src/app/page.tsx", import.meta.url),
      "utf8",
    );

    assert.match(homepage, /Golden Home Care/);
    assert.match(homepage, /Name/);
    assert.match(homepage, /Email/);
    assert.match(homepage, /Phone/);
    assert.match(homepage, /ZIP code/);
    assert.match(homepage, /Relationship to older adult/);
    assert.match(homepage, /Help needed/);
    assert.match(homepage, /Other help needed/);
    assert.match(homepage, /Something else/);
    assert.match(homepage, /How often\?/);
    assert.match(homepage, /When do you need help\?/);
    assert.match(homepage, /Additional notes or feedback/);
    assert.match(homepage, /Find care near me/);
    assert.match(
      homepage,
      /Thanks — we’ll review your request and follow up with next steps\./,
    );
  });
});
