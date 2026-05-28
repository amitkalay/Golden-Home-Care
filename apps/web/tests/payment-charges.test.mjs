import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateBookingCharges } from "../src/app/payments/charges.js";

describe("payment charge calculation", () => {
  it("adds an 11 percent service fee and zero sales tax", () => {
    assert.deepEqual(calculateBookingCharges(3400, 180), {
      serviceAmountCents: 10200,
      platformFeeCents: 1122,
      salesTaxCents: 0,
      totalAmountCents: 11322,
      currency: "usd",
    });
  });

  it("rounds fractional hourly durations to cents", () => {
    assert.deepEqual(calculateBookingCharges(2500, 90), {
      serviceAmountCents: 3750,
      platformFeeCents: 413,
      salesTaxCents: 0,
      totalAmountCents: 4163,
      currency: "usd",
    });
  });

  it("rejects invalid rates and durations", () => {
    assert.throws(() => calculateBookingCharges(0, 60), /hourlyRateCents/);
    assert.throws(() => calculateBookingCharges(1000, 0), /durationMinutes/);
  });
});
