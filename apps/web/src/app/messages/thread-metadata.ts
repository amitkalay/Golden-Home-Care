import type { MessageThreadRecord } from "./db";

export type InboxLifecycleTab = "current" | "upcoming" | "past";

export const inboxLifecycleTabs: Array<{ value: InboxLifecycleTab; label: string }> = [
  { value: "current", label: "Current" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
];

export function formatThreadDate(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(date.getTime())) return "Date TBD";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatThreadTime(value: string) {
  const [hourInput, minute = "00"] = value.split(":");
  const hour = Number.parseInt(hourInput, 10);

  if (!Number.isFinite(hour)) return "Time TBD";

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
}

export function getThreadMatchSourceLabel(source: MessageThreadRecord["matchSource"]) {
  return source === "on_demand" ? "On-demand" : "Weekly availability";
}

export function getThreadSchedule(thread: MessageThreadRecord) {
  const hasProposedTime = Boolean(thread.proposedDate && thread.proposedStartTime && thread.proposedEndTime);

  return {
    date: thread.bookingDate || (hasProposedTime ? thread.proposedDate : thread.requestedDate) || thread.requestedDate,
    startTime:
      thread.bookingStartTime ||
      (hasProposedTime ? thread.proposedStartTime : thread.windowStartTime) ||
      thread.windowStartTime,
    endTime:
      thread.bookingEndTime ||
      (hasProposedTime ? thread.proposedEndTime : thread.windowEndTime) ||
      thread.windowEndTime,
  };
}

function hasThreadEnded(thread: MessageThreadRecord) {
  const scheduledEndTime = thread.scheduledEndAt ? new Date(thread.scheduledEndAt).getTime() : Number.NaN;

  return Number.isFinite(scheduledEndTime) && scheduledEndTime < Date.now();
}

export function getThreadStatusLabel(thread: MessageThreadRecord) {
  if (thread.requestStatus === "completed" || thread.bookingStatus === "completed") return "Complete";
  if (thread.requestStatus === "canceled" || thread.bookingStatus === "canceled") return "Canceled";
  if (thread.matchStatus === "declined") return "Declined";
  if (thread.matchStatus === "expired") return "Expired";
  if ((thread.requestStatus === "confirmed" || thread.bookingStatus === "confirmed") && hasThreadEnded(thread)) {
    return "Complete";
  }
  if (thread.requestStatus === "payment_pending" || thread.bookingStatus === "payment_pending") return "Payment due";
  if (thread.requestStatus === "confirmed" || thread.bookingStatus === "confirmed") return "Confirmed";
  if (thread.matchStatus === "accepted") return "Accepted";
  if (thread.matchStatus === "proposed") return "Proposed";

  return "Pending";
}

export function getThreadStatusTone(thread: MessageThreadRecord) {
  const status = getThreadStatusLabel(thread);

  if (status === "Complete" || status === "Confirmed") return "complete";
  if (status === "Payment due" || status === "Proposed") return "attention";
  if (status === "Canceled" || status === "Declined" || status === "Expired") return "closed";
  if (status === "Accepted") return "accepted";

  return "pending";
}

export function getThreadLifecycleTab(thread: MessageThreadRecord): InboxLifecycleTab {
  if (
    thread.requestStatus === "completed" ||
    thread.requestStatus === "canceled" ||
    thread.bookingStatus === "completed" ||
    thread.bookingStatus === "canceled" ||
    thread.matchStatus === "declined" ||
    thread.matchStatus === "expired"
  ) {
    return "past";
  }

  if (hasThreadEnded(thread)) {
    return "past";
  }

  if (thread.requestStatus === "confirmed" || thread.bookingStatus === "confirmed") {
    return "upcoming";
  }

  return "current";
}

export function getThreadTransactionLine(thread: MessageThreadRecord) {
  const schedule = getThreadSchedule(thread);

  return `${thread.serviceLabel || "Service"} · ${formatThreadDate(schedule.date)} · ${formatThreadTime(
    schedule.startTime,
  )} - ${formatThreadTime(schedule.endTime)}`;
}

export function getThreadDetailLine(thread: MessageThreadRecord) {
  return [`ZIP ${thread.zipCode}`, `${thread.durationMinutes} min`, getThreadMatchSourceLabel(thread.matchSource)]
    .filter(Boolean)
    .join(" · ");
}
