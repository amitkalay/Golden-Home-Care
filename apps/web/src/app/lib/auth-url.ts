export function getSearchParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeCallbackUrl(callbackUrl?: string | null) {
  if (!callbackUrl?.startsWith("/") || callbackUrl.startsWith("//")) {
    return "/";
  }

  return callbackUrl === "/provider" ? "/" : callbackUrl;
}

export function buildAuthStatusHref(path: string, status: string, callbackUrl = "/") {
  const params = new URLSearchParams({ status });
  const normalizedCallbackUrl = normalizeCallbackUrl(callbackUrl);

  if (normalizedCallbackUrl !== "/") {
    params.set("callbackUrl", normalizedCallbackUrl);
  }

  return `${path}?${params.toString()}`;
}
