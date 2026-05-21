import { withAuth } from "next-auth/middleware";
import { getAuthSecret } from "./app/lib/auth-secret";

export default withAuth({
  secret: getAuthSecret(),
  pages: {
    signIn: "/sign-in",
  },
});

export const config = {
  matcher: ["/account/:path*", "/provider/:path*", "/requests/:path*"],
};
