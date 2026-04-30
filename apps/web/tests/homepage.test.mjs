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
  });
});
