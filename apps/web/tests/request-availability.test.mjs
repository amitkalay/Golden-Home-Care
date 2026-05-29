import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getProviderAvailabilityBlocks } from "../src/app/requests/availability.js";

const windows = [{ dayOfWeek: 5, startTime: "09:00", endTime: "12:00" }];

function availability(overrides = {}) {
  return getProviderAvailabilityBlocks({
    availabilityWindows: windows,
    bookings: [],
    requestedDate: "2026-05-29",
    durationMinutes: 60,
    now: new Date("2026-05-28T16:00:00Z"),
    timeZone: "America/Los_Angeles",
    minimumNoticeMinutes: 120,
    ...overrides,
  });
}

describe("provider request availability calendar", () => {
  it("returns normal available windows for the selected day", () => {
    const result = availability();

    assert.equal(result.dayLabel, "Friday");
    assert.equal(result.windows.length, 1);
    assert.deepEqual(result.windows[0].blocks, [
      {
        type: "available",
        startTime: "09:00",
        endTime: "12:00",
        startMinutes: 540,
        endMinutes: 720,
        disabled: false,
      },
    ]);
  });

  it("splits availability around active bookings without private details", () => {
    const result = availability({
      bookings: [
        {
          bookingDate: "2026-05-29",
          startTime: "10:00",
          endTime: "11:00",
          status: "confirmed",
        },
      ],
    });

    assert.deepEqual(result.windows[0].blocks.map((block) => block.type), [
      "available",
      "booked",
      "available",
    ]);
    assert.deepEqual(result.windows[0].blocks[1], {
      type: "booked",
      startTime: "10:00",
      endTime: "11:00",
      startMinutes: 600,
      endMinutes: 660,
      disabled: true,
    });
    assert.equal(JSON.stringify(result).includes("confirmed"), false);
  });

  it("shows full booking coverage as booked only", () => {
    const result = availability({
      bookings: [
        {
          bookingDate: "2026-05-29",
          startTime: "08:00",
          endTime: "13:00",
          status: "payment_pending",
        },
      ],
    });

    assert.deepEqual(result.windows[0].blocks.map((block) => block.type), ["booked"]);
    assert.equal(result.windows[0].blocks[0].startTime, "09:00");
    assert.equal(result.windows[0].blocks[0].endTime, "12:00");
  });

  it("merges overlapping bookings into one generic booked block", () => {
    const result = availability({
      bookings: [
        {
          bookingDate: "2026-05-29",
          startTime: "10:00",
          endTime: "11:00",
          status: "confirmed",
        },
        {
          bookingDate: "2026-05-29",
          startTime: "10:30",
          endTime: "11:30",
          status: "payment_pending",
        },
      ],
    });

    const bookedBlocks = result.windows[0].blocks.filter((block) => block.type === "booked");

    assert.equal(bookedBlocks.length, 1);
    assert.equal(bookedBlocks[0].startTime, "10:00");
    assert.equal(bookedBlocks[0].endTime, "11:30");
    assert.equal(JSON.stringify(bookedBlocks).includes("payment_pending"), false);
  });

  it("disables available segments shorter than the selected duration", () => {
    const result = availability({
      durationMinutes: 90,
      bookings: [
        {
          bookingDate: "2026-05-29",
          startTime: "10:00",
          endTime: "11:00",
          status: "confirmed",
        },
      ],
    });

    const availableBlocks = result.windows[0].blocks.filter((block) => block.type === "available");

    assert.deepEqual(availableBlocks.map((block) => block.disabled), [true, true]);
  });

  it("excludes same-day past and too-soon time", () => {
    const result = availability({
      now: new Date("2026-05-29T16:30:00Z"),
      minimumNoticeMinutes: 120,
    });

    assert.equal(result.windows[0].blocks[0].startTime, "11:30");
    assert.equal(result.windows[0].blocks[0].endTime, "12:00");
    assert.equal(result.windows[0].blocks[0].disabled, true);
  });

  it("returns no windows when the provider has no scheduled availability that day", () => {
    const result = availability({ requestedDate: "2026-05-30" });

    assert.deepEqual(result.windows, []);
  });
});
