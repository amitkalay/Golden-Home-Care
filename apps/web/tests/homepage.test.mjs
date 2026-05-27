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
    const inboxPopover = await readFile(
      new URL("../src/app/messages/inbox-popover.tsx", import.meta.url),
      "utf8",
    );
    const globals = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
    const tagline =
      "Concierge senior center platform bringing premium services and entertainment to you.";

    assert.match(homepage, /Golden Home Care/);
    assert.ok(homepage.includes(tagline));
    assert.equal(homepage.includes("Trusted support for aging parents at home"), false);
    assert.ok(homepage.includes('src="/hero-concierge-services.png"'));
    assert.ok(homepage.includes('alt="Older adults enjoying piano instruction and supportive help at home"'));
    assert.match(homepage, /Find care near me/);
    assert.match(homepage, /Become a provider/);
    assert.ok(homepage.includes('href="/providers"'));
    assert.ok(homepage.includes('"/sign-in?callbackUrl=/provider/onboarding"'));
    assert.match(homepage, /Hello, \{userName\}/);
    assert.match(homepage, /callbackUrl="\/"/);
    assert.match(homepage, /getMessageInboxThreadBundlesForUser/);
    assert.match(homepage, /<InboxPopover currentUserId=\{session\.user\.id\} initialThreads=\{inboxThreads\} \/>/);
    assert.equal(homepage.includes('<Link className="nav-link-button" href="/provider">'), false);
    assert.match(inboxPopover, /Inbox/);
    assert.match(inboxPopover, /aria-haspopup="dialog"/);
    assert.match(inboxPopover, /\/api\/messages\/read/);
    assert.equal(homepage.includes("Starting at"), false);
    assert.equal(homepage.includes("$34/hr"), false);
    assert.equal(homepage.includes("rate-card"), false);
    assert.equal(globals.includes("rate-card"), false);
    assert.equal(homepage.includes('href="#start"'), false);
    assert.equal(homepage.includes("Get started with Golden Home Care"), false);
    assert.equal(homepage.includes("SURVEY_ACKNOWLEDGEMENT"), false);
    assert.equal(homepage.includes("Relationship to older adult"), false);
    assert.equal(homepage.includes("Help needed"), false);
    assert.equal(homepage.includes("Other help needed"), false);
    assert.equal(homepage.includes("How often?"), false);
    assert.equal(homepage.includes("When do you need help?"), false);
    assert.equal(homepage.includes("Additional notes or feedback"), false);
    assert.equal(homepage.includes("ZIP code / service area"), false);
    assert.equal(homepage.includes("Hourly rate"), false);
    assert.equal(homepage.includes("Services you can offer"), false);
    assert.equal(homepage.includes("Senior-care experience"), false);
    assert.equal(homepage.includes("Willing to complete background check?"), false);
    assert.equal(homepage.includes("Apply to join"), false);
    assert.match(homepage, /How Golden Home Care works/);
    assert.match(homepage, /Tell us what your loved one needs/);
    assert.match(homepage, /Browse trusted providers and rates/);
    assert.match(homepage, /Book recurring visits and receive updates/);
    assert.match(homepage, /Simple support for independent living/);
    assert.match(homepage, /Built on trust and safety/);
    assert.equal(homepage.includes("feedback-section"), false);
    assert.equal(homepage.includes("action={sendFeedback}"), false);
    assert.equal(homepage.includes('name="images"'), false);
    assert.equal(homepage.includes("getFeedbackAlert"), false);
    assert.match(homepage, /href="\/feedback"/);
    assert.match(homepage, /Got Feedback/);
    assert.match(homepage, /Help your parent stay independent with trusted support nearby/);
    assert.equal(providerServices.includes("Gardening"), false);
    assert.equal(providerServices.includes("Arts & Crafts"), false);
    for (const label of ["Meal Prep", "Companionship", "Errands", "Walks", "Pickleball Lessons", "Music Lessons"]) {
      assert.ok(providerServices.includes(label));
    }
  });
});
