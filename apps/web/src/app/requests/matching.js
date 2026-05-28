import { distanceMiles } from "../providers/search.js";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function timeToMinutes(value) {
  if (!TIME_PATTERN.test(value)) return Number.NaN;
  const [hours, minutes] = value.split(":").map((part) => Number.parseInt(part, 10));

  return hours * 60 + minutes;
}

function requestedDayOfWeek(requestedDate) {
  const [year, month, day] = requestedDate.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCDay();
}

function localEpochMinutes(date, time) {
  const [year, month, day] = date.split("-").map((part) => Number.parseInt(part, 10));
  const [hours, minutes] = time.split(":").map((part) => Number.parseInt(part, 10));

  return Date.UTC(year, month - 1, day, hours, minutes) / 60000;
}

function nowLocalEpochMinutes(now) {
  return (
    Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
    ) / 60000
  );
}

function hasService(provider, serviceType) {
  return provider.services?.some((service) => service.serviceType === serviceType) ?? false;
}

function getCoveredDistance(provider, location) {
  if (
    !location ||
    typeof provider.latitude !== "number" ||
    typeof provider.longitude !== "number" ||
    typeof provider.serviceRadiusMiles !== "number"
  ) {
    return null;
  }

  const distance = distanceMiles(location, {
    latitude: provider.latitude,
    longitude: provider.longitude,
  });

  return distance <= provider.serviceRadiusMiles ? distance : null;
}

function getWeeklyAvailabilitySource(provider, request) {
  const dayOfWeek = requestedDayOfWeek(request.requestedDate);
  const requestStart = timeToMinutes(request.windowStartTime);
  const requestEnd = timeToMinutes(request.windowEndTime);

  if (!Number.isFinite(requestStart) || !Number.isFinite(requestEnd)) return null;

  const matchingWindow = provider.availabilityWindows?.find((window) => {
    if (window.dayOfWeek !== dayOfWeek) return false;

    const providerStart = timeToMinutes(window.startTime);
    const providerEnd = timeToMinutes(window.endTime);
    const overlapStart = Math.max(requestStart, providerStart);
    const overlapEnd = Math.min(requestEnd, providerEnd);

    return overlapEnd - overlapStart >= request.durationMinutes;
  });

  return matchingWindow ? "weekly" : null;
}

function getOnDemandAvailabilitySource(provider, request, now) {
  if (!provider.onDemandAvailable) return null;

  const requestedStart = localEpochMinutes(request.requestedDate, request.windowStartTime);
  const noticeMinutes = Number.isInteger(provider.minimumNoticeMinutes)
    ? provider.minimumNoticeMinutes
    : 120;

  return requestedStart - nowLocalEpochMinutes(now) >= noticeMinutes ? "on_demand" : null;
}

function hasOverlappingConfirmedBooking(provider, request) {
  return provider.bookings?.some((booking) => {
    return (
      (booking.status === "confirmed" || booking.status === "payment_pending") &&
      booking.bookingDate === request.requestedDate &&
      booking.startTime < request.windowEndTime &&
      booking.endTime > request.windowStartTime
    );
  }) ?? false;
}

export function findRequestProviderMatches(providers, request, { now = new Date() } = {}) {
  const targetProviderId = request.targetProviderId ?? null;

  return providers
    .filter((provider) => targetProviderId === null || provider.id === targetProviderId)
    .map((provider) => {
      if (provider.status !== "active") return null;
      if (!hasService(provider, request.serviceType)) return null;
      if (hasOverlappingConfirmedBooking(provider, request)) return null;

      const distance = getCoveredDistance(provider, request.location);
      if (distance === null) return null;

      const matchSource =
        getWeeklyAvailabilitySource(provider, request) ??
        getOnDemandAvailabilitySource(provider, request, now);

      if (!matchSource) return null;

      return {
        providerProfileId: provider.id,
        matchSource,
        distanceMiles: distance,
      };
    })
    .filter(Boolean)
    .sort((first, second) => {
      return first.distanceMiles - second.distanceMiles || first.providerProfileId - second.providerProfileId;
    });
}
