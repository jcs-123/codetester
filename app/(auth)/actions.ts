"use server";

import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { AuthError, CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";

import { auth, signIn, signOut, updateSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { passwordResetMail, sendEmail } from "@/lib/email";
import {
  createResetToken,
  hashPassword,
  hashResetToken,
  passwordDiffersFromId,
  passwordSchema,
  verifyPassword,
} from "@/lib/password";
import { dashboardPath } from "@/lib/permissions";
import { isLockedOut, recordLoginAttempt } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-next";
import { getBaseUrl } from "@/lib/url";
import { findUserById, findUserByIdOrEmail } from "@/lib/users";

export type FormState = {
  error?: string;
  fields?: Record<string, string>;
  ok?: boolean;
};

const LOGIN_ERRORS: Record<string, string> = {
  invalid: "Incorrect ID or password.",
  locked: "Too many failed attempts. Please try again in 15 minutes.",
  inactive: "This account is inactive. Please contact the administrator.",
  CredentialsSignin: "Incorrect ID or password.",
};

// ---------------------------------------------------------------------------
// ID + password login
// ---------------------------------------------------------------------------
export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const loginId = String(formData.get("loginId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!loginId || !password) return { error: "Enter your ID and password." };

  try {
    await signIn("credentials", { loginId, password, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) {
      const code = e instanceof CredentialsSignin ? e.code : e.type;
      return { error: LOGIN_ERRORS[code] ?? "Sign-in failed. Please try again." };
    }
    throw e;
  }
  redirect(next || "/dashboard");
}

// ---------------------------------------------------------------------------
// Google sign-in (button posts here)
// ---------------------------------------------------------------------------
export async function googleSignInAction(next: string): Promise<void> {
  await signIn("google", { redirectTo: safeNext(next) || "/dashboard" });
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

// ---------------------------------------------------------------------------
// Forgot password (FR-AUTH-08) — response never reveals whether the account exists
// ---------------------------------------------------------------------------
export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const idOrEmail = String(formData.get("idOrEmail") ?? "").trim();
  if (!idOrEmail) return { error: "Enter your ID or email address." };

  // Reuse the login-attempt limiter with a prefixed key (NFR-07).
  const limiterKey = `reset:${idOrEmail.toLowerCase()}`;
  if (!(await isLockedOut(limiterKey))) {
    await recordLoginAttempt(limiterKey, null, false);
    const user = await findUserByIdOrEmail(idOrEmail);
    if (user && user.isActive && user.email) {
      const { raw, hash } = createResetToken();
      await db.transaction(async (tx) => {
        await tx
          .update(passwordResetTokens)
          .set({ usedAt: new Date() })
          .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));
        await tx.insert(passwordResetTokens).values({
          userId: user.id,
          tokenHash: hash,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        });
      });
      const base = await getBaseUrl();
      await sendEmail(passwordResetMail(user.email, user.name, `${base}/reset-password/${raw}`));
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reset password with emailed token
// ---------------------------------------------------------------------------
export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const fields = validateNewPassword(password, confirm);
  if (fields) return { fields };

  const row = token
    ? await db.query.passwordResetTokens.findFirst({
        where: and(
          eq(passwordResetTokens.tokenHash, hashResetToken(token)),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      })
    : undefined;
  if (!row) return { error: "This reset link is invalid or has expired. Please request a new one." };

  const user = await findUserById(row.userId);
  if (!user || !user.isActive) return { error: "This account is not available. Please contact the administrator." };
  if (!passwordDiffersFromId(password, user.loginId)) return { fields: { password: "Password must not be your ID." } };

  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, mustChangePassword: false, sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, user.id));
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));
    await logAudit({ actorId: user.id, action: "user.password_reset", entityType: "user", entityId: user.id }, tx);
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Change password (forced after import/reset, or voluntary from the profile menu)
// ---------------------------------------------------------------------------
export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await findUserById(session.user.id);
  if (!user || !user.isActive) redirect("/login");

  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const fields = validateNewPassword(password, confirm) ?? {};
  if (!(await verifyPassword(current, user.passwordHash))) {
    fields.current = "Current password is incorrect.";
  }
  if (!passwordDiffersFromId(password, user.loginId)) fields.password = "Password must not be your ID.";
  if (Object.keys(fields).length) return { fields };

  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, mustChangePassword: false, sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, user.id));
    await logAudit({ actorId: user.id, action: "user.password_change", entityType: "user", entityId: user.id }, tx);
  });

  // Adopt the new sessionVersion in this session; every other device is logged out.
  await updateSession({});
  redirect(dashboardPath(user.role));
}

function validateNewPassword(password: string, confirm: string): Record<string, string> | null {
  const fields: Record<string, string> = {};
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) fields.password = parsed.error.issues[0]?.message ?? "Invalid password.";
  if (password !== confirm) fields.confirm = "Passwords do not match.";
  return Object.keys(fields).length ? fields : null;
}
