import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("homepage", () => {
  it('includes the company name "Golden Home Care"', async () => {
    const homepage = await readFile(
      new URL("../src/app/page.tsx", import.meta.url),
      "utf8",
    );
    const providerServices = await readFile(
      new URL("../src/app/provider/services.js", import.meta.url),
      "utf8",
    );
    const familyValidation = await readFile(
      new URL("../src/app/family-leads/validation.js", import.meta.url),
      "utf8",
    );
    const tagline =
      "Concierge senior center platform bringing premium services and entertainment to you.";

    assert.match(homepage, /Golden Home Care/);
    assert.ok(homepage.includes(tagline));
    assert.equal(homepage.includes("Trusted support for aging parents at home"), false);
    assert.ok(homepage.includes('src="/hero-concierge-services.png"'));
    assert.ok(homepage.includes('alt="Older adults enjoying piano instruction and supportive help at home"'));
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
    const acknowledgement =
      "We appreciate your help! Your survey responses will directly guide how we build this platform to ensure it meets your needs. We’ll be in touch with next steps as we develop this service.";

    assert.equal(homepage.split(acknowledgement).length - 1, 1);
    assert.match(homepage, /Become a provider/);
    assert.ok(homepage.includes('href="/sign-in"'));
    assert.match(homepage, /ZIP code \/ service area/);
    assert.match(homepage, /Hourly rate/);
    assert.match(homepage, /Services you can offer/);
    assert.equal(providerServices.includes("Gardening"), false);
    assert.equal(providerServices.includes("Arts & Crafts"), false);
    for (const label of ["Meal Prep", "Companionship", "Errands", "Walks", "Pickleball Lessons", "Music Lessons"]) {
      assert.ok(providerServices.includes(label));
    }
    for (const label of ["Walks", "Pickleball Lessons", "Music Lessons"]) {
      assert.ok(familyValidation.includes(label));
    }
    assert.equal(familyValidation.includes("Arts & Crafts"), false);
    assert.match(homepage, /Senior-care experience/);
    assert.match(homepage, /Availability/);
    assert.match(homepage, /Willing to complete background check\?/);
    assert.match(homepage, /Notes/);
    assert.match(homepage, /Apply to join/);
    assert.equal(homepage.split("{SURVEY_ACKNOWLEDGEMENT}").length - 1, 2);
    assert.match(homepage, /type="number"/);
    assert.match(homepage, /step="1"/);
  });
});
