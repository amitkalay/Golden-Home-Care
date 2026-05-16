export type ZipLocation = {
  zipCode: string;
  latitude: number;
  longitude: number;
};

const ZIP_PATTERN = /^\d{5}$/;

export function normalizeZipCode(zipCode: string) {
  const normalized = zipCode.trim();
  return ZIP_PATTERN.test(normalized) ? normalized : null;
}

export async function geocodeZipCode(zipCode: string): Promise<ZipLocation | null> {
  const normalized = normalizeZipCode(zipCode);

  if (!normalized) return null;

  try {
    const response = await fetch(`https://api.zippopotam.us/us/${normalized}`, {
      next: { revalidate: 60 * 60 * 24 * 30 },
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      places?: Array<{
        latitude?: string;
        longitude?: string;
      }>;
    };
    const place = payload.places?.[0];
    const latitude = Number.parseFloat(place?.latitude ?? "");
    const longitude = Number.parseFloat(place?.longitude ?? "");

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return { zipCode: normalized, latitude, longitude };
  } catch {
    return null;
  }
}

