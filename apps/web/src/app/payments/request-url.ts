import { headers } from "next/headers";

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || "";
}

export async function getCurrentRequestBaseUrl() {
  const headerStore = await headers();
  const origin = firstHeaderValue(headerStore.get("origin"));

  if (origin) {
    return origin.replace(/\/$/, "");
  }

  const host = firstHeaderValue(headerStore.get("x-forwarded-host")) || headerStore.get("host");

  if (!host) {
    return undefined;
  }

  const protocol =
    firstHeaderValue(headerStore.get("x-forwarded-proto")) ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${protocol}://${host}`;
}
