import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

import type { AppJWT } from "@/lib/auth-types";
import { env, googleEnabled } from "@/lib/env";

/**
 * The part of the Auth.js configuration that is safe to run in `proxy.ts`
 * (no database, no bcrypt). `lib/auth.ts` extends this with the Credentials
 * provider and the DB-backed `jwt` / `signIn` callbacks.
 */
export const authConfig = {
  secret: env.AUTH_SECRET,
  trustHost: true,
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  providers: googleEnabled
    ? [
        Google({
          clientId: env.AUTH_GOOGLE_ID,
          clientSecret: env.AUTH_GOOGLE_SECRET,
          authorization: {
            params: {
              // Hint only — never trusted for authorization (STACK.md §3).
              hd: env.ALLOWED_EMAIL_DOMAIN,
              prompt: "select_account",
            },
          },
        }),
      ]
    : [],
  callbacks: {
    session({ session, token }) {
      const t = token as AppJWT;
      if (t.uid) {
        session.user.id = t.uid;
        session.user.role = t.role ?? "STUDENT";
        session.user.loginId = t.loginId ?? "";
        session.user.mustChangePassword = Boolean(t.mcp);
        session.user.name = t.name ?? "";
        session.user.email = t.email ?? "";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
