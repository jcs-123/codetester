import { and, count, eq, gt, lt } from "drizzle-orm";

import { db } from "@/lib/db";
import { loginAttempts } from "@/lib/db/schema";

/** FR-AUTH-10: 5 failures within 15 minutes locks the ID for 15 minutes. */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

export async function isLockedOut(loginIdLower: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [row] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.loginId, loginIdLower),
        eq(loginAttempts.succeeded, false),
        gt(loginAttempts.createdAt, since),
      ),
    );
  return (row?.n ?? 0) >= MAX_FAILURES;
}

export async function recordLoginAttempt(
  loginIdLower: string,
  ip: string | null,
  succeeded: boolean,
): Promise<void> {
  await db.insert(loginAttempts).values({ loginId: loginIdLower, ip, succeeded });
  if (succeeded) {
    // A successful login clears the failure counter.
    await db
      .delete(loginAttempts)
      .where(and(eq(loginAttempts.loginId, loginIdLower), eq(loginAttempts.succeeded, false)));
  }
}

/** Called by the cron job — keeps the table small. */
export async function purgeOldLoginAttempts(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, cutoff));
}
