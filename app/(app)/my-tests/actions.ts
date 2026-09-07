"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { attemptAnswers, questions, testAttempts, type Test, type TestAttempt } from "@/lib/db/schema";
import { actionUser } from "@/lib/permissions";
import { fail, ok, type ActionFailure, type ActionResult } from "@/lib/result";
import { finalizeAttempt } from "@/lib/tests/attempts";
import { buildAttemptOrders } from "@/lib/tests/shuffle";
import { computeDeadline, effectiveEndsAt, testStatus } from "@/lib/tests/status";
import { getAttemptForStudent, getQuestionOptionIds, getStudentTest } from "@/lib/tests/student-queries";

/** Network latency allowance after the deadline (SRS §7.5). */
const GRACE_MS = 10_000;

// ===========================================================================
// Start (FR-STU-04, SRS §7.4)
// ===========================================================================
export async function startAttemptAction(testId: string): Promise<ActionResult<{ attemptId: string }>> {
  const { user, error } = await actionUser("STUDENT");
  if (!user) return error;

  const row = await getStudentTest(testId, user.id);
  if (!row) return fail("NOT_FOUND", "This test is not assigned to you.");
  if (row.attempt?.submittedAt) return fail("ATTEMPT_SUBMITTED", "You have already submitted this test.");
  if (row.attempt) redirect(`/my-tests/${testId}/attempt`); // resume
  if (testStatus(row.test) !== "LIVE") return fail("TEST_NOT_LIVE", "This test is not open right now.");

  const qs = await getQuestionOptionIds(testId);
  if (!qs.length) return fail("VALIDATION", "This test has no questions. Please contact your faculty.");

  const now = new Date();
  const { questionOrder, optionOrder } = buildAttemptOrders(qs);
  try {
    await db.insert(testAttempts).values({
      testId,
      studentId: user.id,
      startedAt: now,
      deadlineAt: computeDeadline(now, row.test.durationMinutes, effectiveEndsAt(row.test)),
      questionOrder,
      optionOrder,
    });
  } catch {
    // Unique violation: a second tab started it at the same moment — just resume.
  }
  redirect(`/my-tests/${testId}/attempt`);
}

// ===========================================================================
// Shared guard for in-progress actions
// ===========================================================================
type LiveAttempt = { attempt: TestAttempt; test: Test };

async function loadLiveAttempt(attemptId: string): Promise<LiveAttempt | ActionFailure> {
  const { user, error } = await actionUser("STUDENT");
  if (!user) return error;
  const row = await getAttemptForStudent(attemptId, user.id);
  if (!row) return fail("NOT_FOUND", "Attempt not found.");
  if (row.attempt.submittedAt) return fail("ATTEMPT_SUBMITTED", "This test has already been submitted.");

  const now = Date.now();
  const closedEarly = row.test.closedAt && row.test.closedAt.getTime() <= now;
  if (closedEarly || now > row.attempt.deadlineAt.getTime() + GRACE_MS) {
    await db.transaction((tx) => finalizeAttempt(tx, row.attempt.id, closedEarly ? "CLOSED" : "TIMEOUT"));
    return fail("DEADLINE_PASSED", "Time is up — your answers have been submitted.");
  }
  return row;
}

const isFailure = (x: LiveAttempt | ActionFailure): x is ActionFailure => "ok" in x && x.ok === false;

// ===========================================================================
// Auto-save (FR-STU-07, SRS §7.6) — idempotent upsert
// ===========================================================================
export async function saveAnswerAction(
  attemptId: string,
  questionId: string,
  optionId: string | null,
): Promise<ActionResult<{ savedAt: string }>> {
  const live = await loadLiveAttempt(attemptId);
  if (isFailure(live)) return live;
  const { attempt } = live;

  if (!attempt.questionOrder.includes(questionId)) return fail("VALIDATION", "Unknown question.");
  if (optionId !== null && !(attempt.optionOrder[questionId] ?? []).includes(optionId)) {
    return fail("VALIDATION", "Unknown option.");
  }

  const now = new Date();
  await db
    .insert(attemptAnswers)
    .values({ attemptId, questionId, selectedOptionId: optionId, answeredAt: now })
    .onConflictDoUpdate({
      target: [attemptAnswers.attemptId, attemptAnswers.questionId],
      set: { selectedOptionId: optionId, answeredAt: now },
    });
  return ok({ savedAt: now.toISOString() });
}

// ===========================================================================
// Hint (FR-STU-09) — text is only sent on demand and the use is recorded
// ===========================================================================
export async function revealHintAction(attemptId: string, questionId: string): Promise<ActionResult<{ hint: string }>> {
  const live = await loadLiveAttempt(attemptId);
  if (isFailure(live)) return live;
  if (!live.attempt.questionOrder.includes(questionId)) return fail("VALIDATION", "Unknown question.");

  const [q] = await db.select({ hint: questions.hint }).from(questions).where(eq(questions.id, questionId));
  if (!q?.hint) return fail("NOT_FOUND", "This question has no hint.");

  await db
    .insert(attemptAnswers)
    .values({ attemptId, questionId, selectedOptionId: null, hintUsed: true })
    .onConflictDoUpdate({
      target: [attemptAnswers.attemptId, attemptAnswers.questionId],
      set: { hintUsed: true },
    });
  return ok({ hint: q.hint });
}

// ===========================================================================
// Submit (FR-STU-10, SRS §7.7)
// ===========================================================================
export async function submitAttemptAction(attemptId: string): Promise<ActionResult<{ score: number; total: number }>> {
  const { user, error } = await actionUser("STUDENT");
  if (!user) return error;
  const row = await getAttemptForStudent(attemptId, user.id);
  if (!row) return fail("NOT_FOUND", "Attempt not found.");

  const result = await db.transaction((tx) => finalizeAttempt(tx, attemptId, "MANUAL"));
  return ok({ score: result.score, total: result.total });
}

/** Lazy finalisation used by pages: submits an attempt whose deadline has passed. */
export async function finalizeIfExpired(attempt: TestAttempt, test: Test): Promise<boolean> {
  if (attempt.submittedAt) return false;
  const now = Date.now();
  const closedEarly = test.closedAt && test.closedAt.getTime() <= now;
  if (!closedEarly && now <= attempt.deadlineAt.getTime() + GRACE_MS) return false;
  await db.transaction((tx) => finalizeAttempt(tx, attempt.id, closedEarly ? "CLOSED" : "TIMEOUT"));
  return true;
}

/** Cheap heartbeat used by the runner to detect an early close (FR-STU-18). */
export async function attemptStatusAction(attemptId: string): Promise<ActionResult<{ submitted: boolean; deadlineAt: string; serverNow: string }>> {
  const { user, error } = await actionUser("STUDENT");
  if (!user) return error;
  const row = await getAttemptForStudent(attemptId, user.id);
  if (!row) return fail("NOT_FOUND", "Attempt not found.");
  await finalizeIfExpired(row.attempt, row.test);
  const [fresh] = await db
    .select({ submittedAt: testAttempts.submittedAt, deadlineAt: testAttempts.deadlineAt })
    .from(testAttempts)
    .where(eq(testAttempts.id, attemptId));
  return ok({
    submitted: Boolean(fresh?.submittedAt),
    deadlineAt: (fresh?.deadlineAt ?? row.attempt.deadlineAt).toISOString(),
    serverNow: new Date().toISOString(),
  });
}

// Keeps drizzle's sql import used for potential raw expressions in this module.
void sql;
