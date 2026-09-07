import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { authConfig } from "@/lib/auth.config";
import type { AppJWT } from "@/lib/auth-types";
import { allowedExtraEmails, env } from "@/lib/env";
import { verifyPassword } from "@/lib/password";
import { isLockedOut, recordLoginAttempt } from "@/lib/rate-limit";
import { findUserByEmail, findUserById, findUserByLoginId, touchLastLogin } from "@/lib/users";

// Error codes surfaced to the login form. Never reveal which field was wrong.
export class InvalidCredentials extends CredentialsSignin {
  code = "invalid";
}
export class AccountLocked extends CredentialsSignin {
  code = "locked";
}
export class AccountInactive extends CredentialsSignin {
  code = "inactive";
}

const credentialsSchema = z.object({
  loginId: z.string().trim().min(1).max(60),
  password: z.string().min(1).max(200),
});

/** Re-validate the JWT against the database at most this often. */
const REVALIDATE_MS = 60_000;

export const { handlers, auth, signIn, signOut, unstable_update: updateSession } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        loginId: { label: "Staff ID / Student ID" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidCredentials();

        const loginId = parsed.data.loginId.toLowerCase();
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

        if (await isLockedOut(loginId)) throw new AccountLocked();

        const user = await findUserByLoginId(loginId);
        const ok = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;

        await recordLoginAttempt(loginId, ip, ok);
        if (!user || !ok) throw new InvalidCredentials();
        if (!user.isActive) throw new AccountInactive();

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          loginId: user.loginId,
          mustChangePassword: user.mustChangePassword,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true; // credentials validated in authorize()

      const email = profile?.email?.toLowerCase();
      if (!email || profile?.email_verified !== true) return "/login?error=google_unverified";

      const domainOk =
        email.endsWith(`@${env.ALLOWED_EMAIL_DOMAIN.toLowerCase()}`) || allowedExtraEmails.includes(email);
      if (!domainOk) return "/login?error=domain";

      // Google sign-in never creates accounts (FR-AUTH-04).
      const user = await findUserByEmail(email);
      if (!user) return "/login?error=not_found";
      if (!user.isActive) return "/login?error=inactive";
      return true;
    },

    async jwt({ token: rawToken, user, account, trigger }) {
      const token = rawToken as AppJWT;

      // Sign-in: resolve the DB user and stamp the token.
      if (account && user) {
        const dbUser =
          account.provider === "google"
            ? user.email
              ? await findUserByEmail(user.email)
              : null
            : user.id
              ? await findUserById(user.id)
              : null;
        if (!dbUser || !dbUser.isActive) return null;

        token.uid = dbUser.id;
        token.role = dbUser.role;
        token.loginId = dbUser.loginId;
        token.sv = dbUser.sessionVersion;
        token.mcp = dbUser.mustChangePassword;
        token.name = dbUser.name;
        token.email = dbUser.email;
        token.chk = Date.now();
        await touchLastLogin(dbUser.id);
        return token;
      }

      if (!token.uid) return null;

      // Periodic re-validation (STACK.md §3): deactivation, role change or a
      // sessionVersion bump logs the user out everywhere within a minute.
      const stale = Date.now() - (token.chk ?? 0) > REVALIDATE_MS;
      if (stale || trigger === "update") {
        const dbUser = await findUserById(token.uid);
        if (!dbUser || !dbUser.isActive || dbUser.sessionVersion !== token.sv) {
          // On an explicit update (e.g. the user just changed their own
          // password) adopt the new version instead of logging them out.
          if (trigger === "update" && dbUser && dbUser.isActive) {
            token.sv = dbUser.sessionVersion;
          } else {
            return null;
          }
        }
        token.role = dbUser.role;
        token.mcp = dbUser.mustChangePassword;
        token.name = dbUser.name;
        token.email = dbUser.email;
        token.chk = Date.now();
      }
      return token;
    },
  },
});
