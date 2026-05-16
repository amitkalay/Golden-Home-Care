export function distanceMiles(origin, destination) {
  const earthRadiusMiles = 3958.8;
  const toRadians = (value) => (value * Math.PI) / 180;
  const latDelta = toRadians(destination.latitude - origin.latitude);
  const lonDelta = toRadians(destination.longitude - origin.longitude);
  const originLat = toRadians(origin.latitude);
  const destinationLat = toRadians(destination.latitude);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(lonDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMiles * c;
}

export function filterProviderSearchResults(providers, { service, location }) {
  return providers.filter((provider) => {
    if (provider.status !== "active") return false;
    if (service && !provider.services.some((item) => item.serviceType === service)) return false;

    if (!location) return true;
    if (
      typeof provider.latitude !== "number" ||
      typeof provider.longitude !== "number" ||
      typeof provider.serviceRadiusMiles !== "number"
    ) {
      return false;
    }

    const distance = distanceMiles(location, {
      latitude: provider.latitude,
      longitude: provider.longitude,
    });

    return distance <= provider.serviceRadiusMiles;
  });
}

