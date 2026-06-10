import type { Adapter } from "next-auth/adapters";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import NeonAdapter from "@auth/neon-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { getAuthSecret } from "./auth-secret";
import { ensureAuthTables, getPool } from "./database";
import {
  authenticatePasswordUser,
  getUserRole,
  markGoogleEmailVerified,
} from "./password-accounts";
import { normalizeEmail } from "./password-security.js";

function getGoogleCredentials() {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;

  if (!clientId || !clientSecret) {
    return {
      clientId: clientId || "missing-google-client-id",
      clientSecret: clientSecret || "missing-google-client-secret",
    };
  }

  return { clientId, clientSecret };
}

const adapterMethodNames = [
  "createVerificationToken",
  "useVerificationToken",
  "createUser",
  "getUser",
  "getUserByEmail",
  "getUserByAccount",
  "updateUser",
  "linkAccount",
  "createSession",
  "getSessionAndUser",
  "updateSession",
  "deleteSession",
  "unlinkAccount",
  "deleteUser",
] as const;

let neonAdapter: Adapter | null = null;

function getNeonAdapter() {
  if (!neonAdapter) {
    neonAdapter = NeonAdapter(getPool());
  }

  return neonAdapter;
}

function createLazyNeonAdapter(): Adapter {
  const adapter: Record<string, unknown> = {};

  for (const methodName of adapterMethodNames) {
    adapter[methodName] = async (...args: unknown[]) => {
      await ensureAuthTables();
      const method = getNeonAdapter()[methodName];

      if (typeof method !== "function") {
        return null;
      }

      return (method as (...args: unknown[]) => unknown)(...args);
    };
  }

  return adapter as Adapter;
}

export const authOptions: NextAuthOptions = {
  adapter: createLazyNeonAdapter(),
  secret: getAuthSecret(),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        return authenticatePasswordUser(credentials?.email, credentials?.password);
      },
    }),
    GoogleProvider({
      ...getGoogleCredentials(),
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: normalizeEmail(profile.email),
          image: profile.picture,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;
      await ensureAuthTables();

      if (account?.provider === "google") {
        const googleProfile = profile as { email?: unknown; email_verified?: unknown };
        return Boolean(googleProfile.email && googleProfile.email_verified === true);
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        const role = (user as { role?: string }).role ?? (await getUserRole(user.id));
        token.id = user.id;
        token.role = role === "provider" ? "provider" : "user";
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role === "provider" ? "provider" : "user";
      }

      return session;
    },
  },
  events: {
    async signIn({ account, profile }) {
      if (account?.provider === "google" && (profile as { email_verified?: unknown })?.email_verified === true) {
        await markGoogleEmailVerified((profile as { email?: unknown })?.email);
      }
    },
  },
};

export async function getCurrentUserSession() {
  return getServerSession(authOptions);
}

export async function requireUser() {
  const session = await getCurrentUserSession();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  return session.user;
}
