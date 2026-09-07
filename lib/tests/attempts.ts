import { and, count, eq, isNull, lte } from "drizzle-orm";

import { db, type Db, type Tx } from "@/lib/db";
import { attemptAnswers, questions, testAttempts, tests, type SubmitType } from "@/lib/db/schema";

export type Conn = Db | Tx;

/**
 * Finalises one attempt: computes the score and marks it submitted (SRS §7.7).
 * Idempotent — a second call returns the stored result.
 */
export async function finalizeAttempt(
  conn: Conn,
  attemptId: string,
  submitType: SubmitType,
): Promise<{ score: number; total: number; alreadySubmitted: boolean }> {
  const [attempt] = await conn.select().from(testAttempts).where(eq(testAttempts.id, attemptId)).for("update");
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.submittedAt) {
    return { score: attempt.score ?? 0, total: attempt.totalQuestions ?? 0, alreadySubmitted: true };
  }

  const [correct] = await conn
    .select({ n: count() })
    .from(attemptAnswers)
    .innerJoin(questions, eq(questions.id, attemptAnswers.questionId))
    .where(and(eq(attemptAnswers.attemptId, attemptId), eq(attemptAnswers.selectedOptionId, questions.correctOptionId)));
  const [hints] = await conn
    .select({ n: count() })
    .from(attemptAnswers)
    .where(and(eq(attemptAnswers.attemptId, attemptId), eq(attemptAnswers.hintUsed, true)));
  const [test] = await conn.select({ questionCount: tests.questionCount }).from(tests).where(eq(tests.id, attempt.testId));

  const total = test?.questionCount ?? attempt.questionOrder.length;
  const score = correct?.n ?? 0;
  await conn
    .update(testAttempts)
    .set({ submittedAt: new Date(), submitType, score, totalQuestions: total, hintsUsed: hints?.n ?? 0 })
    .where(eq(testAttempts.id, attemptId));
  return { score, total, alreadySubmitted: false };
}

/** "Close now": every in-progress attempt of the test is finalised (FR-STU-18). */
export async function finalizeOpenAttempts(conn: Conn, testId: string, submitType: SubmitType): Promise<number> {
  const open = await conn
    .select({ id: testAttempts.id })
    .from(testAttempts)
    .where(and(eq(testAttempts.testId, testId), isNull(testAttempts.submittedAt), isNull(testAttempts.supersededAt)));
  for (const a of open) await finalizeAttempt(conn, a.id, submitType);
  return open.length;
}

/** Cron safety net and lazy path: attempts whose deadline (plus grace) has passed (SRS §7.5). */
export async function finalizeExpiredAttempts(conn: Conn = db, graceMs = 10_000): Promise<number> {
  const cutoff = new Date(Date.now() - graceMs);
  const expired = await conn
    .select({ id: testAttempts.id })
    .from(testAttempts)
    .where(and(isNull(testAttempts.submittedAt), isNull(testAttempts.supersededAt), lte(testAttempts.deadlineAt, cutoff)));
  for (const a of expired) await finalizeAttempt(conn, a.id, "TIMEOUT");
  return expired.length;
}
