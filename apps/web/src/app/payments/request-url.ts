import { headers } from "next/headers";

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || "";
}

function normalizeBaseUrl(value?: string | null) {
  return value?.trim().replace(/\/$/, "") || "";
}

function getConfiguredBaseUrl() {
  return normalizeBaseUrl(
    process.env.APP_BASE_URL ||
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""),
  );
}

function isLocalBaseUrl(value: string) {
  try {
    const { hostname } = new URL(value);

    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export async function getCurrentRequestBaseUrl() {
  const headerStore = await headers();
  const configuredBaseUrl = getConfiguredBaseUrl();
  const origin = normalizeBaseUrl(firstHeaderValue(headerStore.get("origin")));
  const host = firstHeaderValue(headerStore.get("x-forwarded-host")) || firstHeaderValue(headerStore.get("host"));
  const requestBaseUrl = origin || (host ? getRequestBaseUrl(host, headerStore) : "");

  if (requestBaseUrl && process.env.NODE_ENV !== "production" && isLocalBaseUrl(requestBaseUrl)) {
    return requestBaseUrl;
  }

  if (process.env.NODE_ENV === "production") {
    return configuredBaseUrl || undefined;
  }

  return configuredBaseUrl || requestBaseUrl || undefined;
}

function getRequestBaseUrl(host: string, headerStore: Awaited<ReturnType<typeof headers>>) {
  const protocol =
    firstHeaderValue(headerStore.get("x-forwarded-proto")) ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]")
      ? "http"
      : "https");

  return `${protocol}://${host}`;
}
