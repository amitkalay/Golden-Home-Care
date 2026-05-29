const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function timeToMinutes(value) {
  if (!TIME_PATTERN.test(value)) return Number.NaN;
  const [hours, minutes] = value.split(":").map((part) => Number.parseInt(part, 10));

  return hours * 60 + minutes;
}

function minutesToTime(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

export function formatAvailabilityTime(value) {
  const minutes = typeof value === "number" ? value : timeToMinutes(value);
  if (!Number.isFinite(minutes)) return "Time unavailable";

  const hours = Math.floor(minutes / 60);
  const displayHour = hours % 12 || 12;
  const suffix = hours >= 12 ? "PM" : "AM";

  return `${displayHour}:${(minutes % 60).toString().padStart(2, "0")} ${suffix}`;
}

function requestedDayOfWeek(requestedDate) {
  const [year, month, day] = requestedDate.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCDay();
}

function getLocalDateParts(now, timeZone) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now).map((part) => [part.type, part.value]),
  );
}

function getLocalDateString(now, timeZone) {
  const parts = getLocalDateParts(now, timeZone);

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getCurrentLocalMinutes(now, timeZone) {
  const parts = getLocalDateParts(now, timeZone);

  return Number.parseInt(parts.hour, 10) * 60 + Number.parseInt(parts.minute, 10);
}

function getActiveBookings(bookings, requestedDate) {
  const activeBookings = bookings
    .filter((booking) => {
      return (
        booking.bookingDate === requestedDate &&
        (booking.status === "confirmed" || booking.status === "payment_pending")
      );
    })
    .map((booking) => ({
      startMinutes: timeToMinutes(booking.startTime),
      endMinutes: timeToMinutes(booking.endTime),
    }))
    .filter((booking) => Number.isFinite(booking.startMinutes) && Number.isFinite(booking.endMinutes))
    .sort((first, second) => first.startMinutes - second.startMinutes || first.endMinutes - second.endMinutes);

  return activeBookings.reduce((merged, booking) => {
    const previous = merged[merged.length - 1];

    if (!previous || booking.startMinutes > previous.endMinutes) {
      merged.push({ ...booking });
      return merged;
    }

    previous.endMinutes = Math.max(previous.endMinutes, booking.endMinutes);
    return merged;
  }, []);
}

function getDisplayStart(windowStart, requestedDate, now, timeZone, minimumNoticeMinutes) {
  if (requestedDate !== getLocalDateString(now, timeZone)) {
    return windowStart;
  }

  return Math.max(windowStart, getCurrentLocalMinutes(now, timeZone) + minimumNoticeMinutes);
}

export function getProviderAvailabilityBlocks({
  availabilityWindows,
  bookings,
  requestedDate,
  durationMinutes,
  now = new Date(),
  timeZone = "America/Los_Angeles",
  minimumNoticeMinutes = 0,
}) {
  const dayOfWeek = requestedDayOfWeek(requestedDate);
  const dayLabel = DAY_NAMES[dayOfWeek] ?? "Selected day";
  const activeBookings = getActiveBookings(bookings, requestedDate);
  const windows = availabilityWindows
    .filter((window) => window.dayOfWeek === dayOfWeek)
    .map((window) => ({
      startMinutes: timeToMinutes(window.startTime),
      endMinutes: timeToMinutes(window.endTime),
    }))
    .filter((window) => Number.isFinite(window.startMinutes) && Number.isFinite(window.endMinutes))
    .sort((first, second) => first.startMinutes - second.startMinutes || first.endMinutes - second.endMinutes);

  return {
    dayLabel,
    windows: windows.map((window) => {
      const displayStart = getDisplayStart(
        window.startMinutes,
        requestedDate,
        now,
        timeZone,
        minimumNoticeMinutes,
      );
      const blocks = [];
      let cursor = displayStart;

      for (const booking of activeBookings) {
        const bookedStart = Math.max(booking.startMinutes, window.startMinutes, displayStart);
        const bookedEnd = Math.min(booking.endMinutes, window.endMinutes);

        if (bookedStart >= bookedEnd) continue;

        if (cursor < bookedStart) {
          blocks.push({
            type: "available",
            startTime: minutesToTime(cursor),
            endTime: minutesToTime(bookedStart),
            startMinutes: cursor,
            endMinutes: bookedStart,
            disabled: bookedStart - cursor < durationMinutes,
          });
        }

        blocks.push({
          type: "booked",
          startTime: minutesToTime(bookedStart),
          endTime: minutesToTime(bookedEnd),
          startMinutes: bookedStart,
          endMinutes: bookedEnd,
          disabled: true,
        });
        cursor = Math.max(cursor, bookedEnd);
      }

      if (cursor < window.endMinutes) {
        blocks.push({
          type: "available",
          startTime: minutesToTime(cursor),
          endTime: minutesToTime(window.endMinutes),
          startMinutes: cursor,
          endMinutes: window.endMinutes,
          disabled: window.endMinutes - cursor < durationMinutes,
        });
      }

      return {
        startTime: minutesToTime(window.startMinutes),
        endTime: minutesToTime(window.endMinutes),
        startMinutes: window.startMinutes,
        endMinutes: window.endMinutes,
        blocks,
      };
    }),
  };
}
