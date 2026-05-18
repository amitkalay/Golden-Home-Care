import type { Adapter } from "next-auth/adapters";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import NeonAdapter from "@auth/neon-adapter";
import GoogleProvider from "next-auth/providers/google";
import { getAuthSecret } from "./auth-secret";
import { ensureAuthTables, getPool } from "./database";

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
    GoogleProvider({
      ...getGoogleCredentials(),
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      await ensureAuthTables();
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        const role = (user as { role?: string }).role;
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
