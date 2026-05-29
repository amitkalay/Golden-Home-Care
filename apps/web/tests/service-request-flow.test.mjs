import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("service request flow source checks", () => {
  it("protects request routes with auth middleware", async () => {
    const proxy = await readFile(new URL("../src/proxy.ts", import.meta.url), "utf8");

    assert.match(proxy, /"\/requests\/:path\*"/);
    assert.match(proxy, /"\/payments\/:path\*"/);
  });

  it("links provider search and provider cards to the request form", async () => {
    const providersPage = await readFile(new URL("../src/app/providers/page.tsx", import.meta.url), "utf8");

    assert.match(providersPage, /buildRequestHref/);
    assert.match(providersPage, /\/requests\/new/);
    assert.doesNotMatch(providersPage, /matchPreference: "any"/);
    assert.match(providersPage, /params\.set\("matchPreference", "specific"\)/);
    assert.match(providersPage, /providerId: provider\.id/);
    assert.match(providersPage, /Request service/);
  });

  it("prefills requester contact and creates requests through a server action", async () => {
    const newRequestPage = await readFile(new URL("../src/app/requests/new/page.tsx", import.meta.url), "utf8");
    const requestForm = await readFile(new URL("../src/app/requests/new/request-service-form.tsx", import.meta.url), "utf8");
    const actions = await readFile(new URL("../src/app/requests/actions.ts", import.meta.url), "utf8");
    const db = await readFile(new URL("../src/app/requests/db.ts", import.meta.url), "utf8");

    assert.match(newRequestPage, /requireUser\(\)/);
    assert.match(newRequestPage, /getUserAccount\(user\.id\)/);
    assert.match(newRequestPage, /Select a provider first/);
    assert.match(newRequestPage, /<RequestServiceForm/);
    assert.match(newRequestPage, /action=\{createServiceRequest\}/);
    assert.match(newRequestPage, /provider=\{provider\}/);
    assert.match(newRequestPage, /today=\{getTodayDateString\(provider\.availabilityTimezone\)\}/);
    assert.match(requestForm, /name="matchPreference" type="hidden" value="specific"/);
    assert.match(requestForm, /defaultValue=\{getStateValue\(state, "contactName", contactName\)\}/);
    assert.match(requestForm, /defaultValue=\{getStateValue\(state, "contactEmail", contactEmail\)\}/);
    assert.match(actions, /parseServiceRequestForm\(formData\)/);
    assert.match(actions, /geocodeZipCode\(result\.data\.zipCode\)/);
    assert.match(actions, /_previousState: CreateServiceRequestState/);
    assert.match(actions, /buildRequestErrorState\(formData, result\.errors as CreateServiceRequestFieldErrors\)/);
    assert.match(actions, /zipCode: "Enter a ZIP code we can locate"/);
    assert.doesNotMatch(actions, /buildNewRequestRedirect/);
    assert.match(actions, /redirect\(`\/requests\/\$\{requestId\}`\)/);
    assert.match(db, /findRequestProviderMatches/);
    assert.match(db, /INSERT INTO request_provider_matches/);
  });

  it("loads provider availability and renders a generic selected-day calendar", async () => {
    const requestForm = await readFile(new URL("../src/app/requests/new/request-service-form.tsx", import.meta.url), "utf8");
    const db = await readFile(new URL("../src/app/requests/db.ts", import.meta.url), "utf8");
    const availability = await readFile(new URL("../src/app/requests/availability.js", import.meta.url), "utf8");

    assert.match(db, /p\.availability_timezone as "availabilityTimezone"/);
    assert.match(db, /p\.on_demand_available as "onDemandAvailable"/);
    assert.match(db, /p\.minimum_notice_minutes as "minimumNoticeMinutes"/);
    assert.match(db, /provider_availability_windows paw/);
    assert.match(db, /service_bookings sb/);
    assert.match(db, /sb\.status in \('payment_pending', 'confirmed'\)/);
    assert.match(requestForm, /getProviderAvailabilityBlocks/);
    assert.match(requestForm, /availabilityWindows: provider\.availabilityWindows/);
    assert.match(requestForm, /bookings: provider\.bookings/);
    assert.match(requestForm, /request-availability-calendar/);
    assert.match(requestForm, /\? "Booked"/);
    assert.match(requestForm, /selectAvailabilitySlot\(block\.startTime, block\.endTime\)/);
    assert.match(requestForm, /setWindowStartTime\(startTime\)/);
    assert.match(requestForm, /setWindowEndTime\(endTime\)/);
    assert.match(availability, /type: "booked"/);
    assert.match(availability, /minimumNoticeMinutes/);
  });

  it("blocks unavailable selected providers before creating request rows", async () => {
    const actions = await readFile(new URL("../src/app/requests/actions.ts", import.meta.url), "utf8");
    const db = await readFile(new URL("../src/app/requests/db.ts", import.meta.url), "utf8");

    assert.match(db, /UnavailableProviderMatchError/);
    assert.match(db, /input\.matchPreference === "specific" && matches\.length === 0/);
    assert.match(db, /throw new UnavailableProviderMatchError\(\)/);
    assert.match(actions, /error instanceof UnavailableProviderMatchError/);
    assert.match(actions, /timeWindow: "This provider is not available for the selected date, time, duration, or existing bookings"/);
    assert.match(actions, /providerProfileId: "Choose an active provider before submitting"/);
    assert.match(actions, /This provider does not offer the selected service/);
  });

  it("scopes confirmation page lookup to the signed-in requester", async () => {
    const confirmationPage = await readFile(new URL("../src/app/requests/[id]/page.tsx", import.meta.url), "utf8");
    const db = await readFile(new URL("../src/app/requests/db.ts", import.meta.url), "utf8");

    assert.match(confirmationPage, /requireUser\(\)/);
    assert.match(confirmationPage, /getServiceRequestForRequester\(requestId, user\.id\)/);
    assert.match(confirmationPage, /formatRequestStatus\(request\.status\)/);
    assert.match(confirmationPage, /PaymentReceipt/);
    assert.match(confirmationPage, /payForServiceRequest/);
    assert.match(confirmationPage, /hasMatches/);
    assert.match(confirmationPage, /no eligible provider matched the selected time/i);
    assert.match(confirmationPage, /request\.matches/);
    assert.match(db, /request_provider_matches/);
    assert.match(db, /sr\.requester_user_id = \$\{requesterUserId\}/);
  });
});
