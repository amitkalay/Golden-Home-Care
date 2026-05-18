export function getAuthSecret() {
  return (
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV === "production" ? undefined : "golden-home-care-local-dev-secret")
  );
}
