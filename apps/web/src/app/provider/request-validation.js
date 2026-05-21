const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_NOTE_LENGTH = 500;
const MIN_PROPOSAL_MINUTES = 30;

function getValue(input, key) {
  const value =
    typeof input.get === "function" ? input.get(key) : (input[key] ?? "");

  return typeof value === "string" ? value.trim() : "";
}

function isValidDateString(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function timeToMinutes(value) {
  if (!TIME_PATTERN.test(value)) return Number.NaN;
  const [hours, minutes] = value.split(":").map((part) => Number.parseInt(part, 10));

  return hours * 60 + minutes;
}

export function getTodayDateString(timeZone = "America/Los_Angeles") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function parseProviderMatchId(input) {
  const matchId = Number.parseInt(getValue(input, "matchId"), 10);

  return Number.isInteger(matchId) && matchId > 0 ? matchId : null;
}

export function parseProviderRequestProposalForm(
  input,
  { today = getTodayDateString(), minimumMinutes = MIN_PROPOSAL_MINUTES } = {},
) {
  const matchId = parseProviderMatchId(input);
  const data = {
    matchId,
    proposedDate: getValue(input, "proposedDate"),
    proposedStartTime: getValue(input, "proposedStartTime"),
    proposedEndTime: getValue(input, "proposedEndTime"),
    providerResponseNote: getValue(input, "providerResponseNote"),
  };
  const errors = {};

  if (!matchId) {
    errors.matchId = "Select a request";
  }

  if (!isValidDateString(data.proposedDate)) {
    errors.proposedDate = "Enter a valid date";
  } else if (data.proposedDate < today) {
    errors.proposedDate = "Choose today or a future date";
  }

  const startMinutes = timeToMinutes(data.proposedStartTime);
  const endMinutes = timeToMinutes(data.proposedEndTime);

  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
    errors.proposedTime = "Enter valid start and end times";
  } else if (startMinutes >= endMinutes) {
    errors.proposedTime = "End time must be after start time";
  } else if (endMinutes - startMinutes < minimumMinutes) {
    errors.proposedTime = `Proposed window must be at least ${minimumMinutes} minutes`;
  }

  if (data.providerResponseNote.length > MAX_NOTE_LENGTH) {
    errors.providerResponseNote = "Too long";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, data, errors };
  }

  return { ok: true, data, errors: {} };
}
