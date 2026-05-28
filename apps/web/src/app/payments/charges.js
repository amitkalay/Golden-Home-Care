export const PLATFORM_FEE_RATE = 0.11;

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

export function calculateBookingCharges(hourlyRateCents, durationMinutes) {
  assertPositiveInteger(hourlyRateCents, "hourlyRateCents");
  assertPositiveInteger(durationMinutes, "durationMinutes");

  const serviceAmountCents = Math.round((hourlyRateCents * durationMinutes) / 60);
  const platformFeeCents = Math.round(serviceAmountCents * PLATFORM_FEE_RATE);
  const salesTaxCents = 0;

  return {
    serviceAmountCents,
    platformFeeCents,
    salesTaxCents,
    totalAmountCents: serviceAmountCents + platformFeeCents + salesTaxCents,
    currency: "usd",
  };
}
