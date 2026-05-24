import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("next image configuration", () => {
  it("allows provider photos from Vercel Blob and Google account avatars", async () => {
    const config = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");

    assert.ok(config.includes('hostname: "*.public.blob.vercel-storage.com"'));
    assert.ok(config.includes('hostname: "lh3.googleusercontent.com"'));
  });

  it("allows profile photo server actions up to the app upload limit", async () => {
    const config = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");

    assert.match(config, /serverActions:\s*{/);
    assert.match(config, /bodySizeLimit:\s*"4\.5mb"/);
  });
});
