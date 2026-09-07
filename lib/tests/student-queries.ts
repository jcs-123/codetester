import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  attemptAnswers,
  questionOptions,
  questions,
  testAssignments,
  testAttempts,
  tests,
  users,
  type Test,
  type TestAttempt,
} from "@/lib/db/schema";
import { answerOutcome, type AnswerOutcome } from "@/lib/tests/scoring";

export type StudentTestRow = { test: Test; attempt: TestAttempt | null; facultyName: string | null };

/** Every test assigned to the student with their live attempt, if any. */
export async function listStudentTests(studentId: string): Promise<StudentTestRow[]> {
  return db
    .select({ test: tests, attempt: testAttempts, facultyName: users.name })
    .from(testAssignments)
    .innerJoin(tests, and(eq(tests.id, testAssignments.testId), isNull(tests.deletedAt)))
    .leftJoin(
      testAttempts,
      and(eq(testAttempts.testId, tests.id), eq(testAttempts.studentId, studentId), isNull(testAttempts.supersededAt)),
    )
    .leftJoin(users, eq(users.id, tests.createdById))
    .where(eq(testAssignments.studentId, studentId));
}

/** One assigned test for the student (null when not assigned — FR-STU-16). */
export async function getStudentTest(testId: string, studentId: string): Promise<StudentTestRow | null> {
  const [row] = await db
    .select({ test: tests, attempt: testAttempts, facultyName: users.name })
    .from(testAssignments)
    .innerJoin(tests, and(eq(tests.id, testAssignments.testId), isNull(tests.deletedAt)))
    .leftJoin(
      testAttempts,
      and(eq(testAttempts.testId, tests.id), eq(testAttempts.studentId, studentId), isNull(testAttempts.supersededAt)),
    )
    .leftJoin(users, eq(users.id, tests.createdById))
    .where(and(eq(testAssignments.testId, testId), eq(testAssignments.studentId, studentId)))
    .limit(1);
  return row ?? null;
}

export async function getAttemptForStudent(attemptId: string, studentId: string): Promise<{ attempt: TestAttempt; test: Test } | null> {
  const [row] = await db
    .select({ attempt: testAttempts, test: tests })
    .from(testAttempts)
    .innerJoin(tests, eq(tests.id, testAttempts.testId))
    .where(and(eq(testAttempts.id, attemptId), eq(testAttempts.studentId, studentId), isNull(testAttempts.supersededAt)))
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Payload for the test-taking page — NEVER includes correct answers (NFR-03).
// ---------------------------------------------------------------------------
export type RunnerQuestion = {
  id: string;
  text: string;
  hasHint: boolean;
  /** Hint text is included only once the student has already revealed it. */
  hint: string | null;
  hintUsed: boolean;
  options: { id: string; text: string }[];
  selectedOptionId: string | null;
};

export type RunnerPayload = {
  attemptId: string;
  testId: string;
  testName: string;
  subject: string;
  deadlineAt: string;
  serverNow: string;
  questions: RunnerQuestion[];
};

export async function getRunnerPayload(attempt: TestAttempt, test: Test): Promise<RunnerPayload> {
  const qs = await db
    .select({ id: questions.id, text: questions.text, hint: questions.hint })
    .from(questions)
    .where(eq(questions.testId, test.id));
  const opts = await db
    .select({ id: questionOptions.id, questionId: questionOptions.questionId, text: questionOptions.text })
    .from(questionOptions)
    .where(sql`${questionOptions.questionId} in ${qs.map((q) => q.id)}`);
  const answers = await db
    .select({ questionId: attemptAnswers.questionId, selectedOptionId: attemptAnswers.selectedOptionId, hintUsed: attemptAnswers.hintUsed })
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attempt.id));

  const qById = new Map(qs.map((q) => [q.id, q]));
  const oById = new Map(opts.map((o) => [o.id, o]));
  const aByQ = new Map(answers.map((a) => [a.questionId, a]));

  const ordered: RunnerQuestion[] = [];
  for (const qid of attempt.questionOrder) {
    const q = qById.get(qid);
    if (!q) continue;
    const a = aByQ.get(qid);
    const hintUsed = a?.hintUsed ?? false;
    ordered.push({
      id: q.id,
      text: q.text,
      hasHint: Boolean(q.hint),
      hint: hintUsed ? q.hint : null,
      hintUsed,
      options: (attempt.optionOrder[qid] ?? [])
        .map((oid) => oById.get(oid))
        .filter((o): o is NonNullable<typeof o> => Boolean(o))
        .map((o) => ({ id: o.id, text: o.text })),
      selectedOptionId: a?.selectedOptionId ?? null,
    });
  }

  return {
    attemptId: attempt.id,
    testId: test.id,
    testName: test.name,
    subject: `${test.subjectCode} · ${test.subjectName}`,
    deadlineAt: attempt.deadlineAt.toISOString(),
    serverNow: new Date().toISOString(),
    questions: ordered,
  };
}

// ---------------------------------------------------------------------------
// Review payload (after submission) — answers included only when `withAnswers`.
// ---------------------------------------------------------------------------
export type ReviewQuestion = {
  id: string;
  text: string;
  options: { id: string; label: string; text: string }[];
  selectedOptionId: string | null;
  hintUsed: boolean;
  hint: string | null;
  correctOptionId: string | null;
  explanation: string | null;
  outcome: AnswerOutcome | null;
};

export async function getReviewPayload(attempt: TestAttempt, test: Test, withAnswers: boolean): Promise<ReviewQuestion[]> {
  const qs = await db.select().from(questions).where(eq(questions.testId, test.id));
  const opts = await db
    .select({ id: questionOptions.id, questionId: questionOptions.questionId, text: questionOptions.text })
    .from(questionOptions)
    .where(sql`${questionOptions.questionId} in ${qs.map((q) => q.id)}`);
  const answers = await db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attempt.id));

  const qById = new Map(qs.map((q) => [q.id, q]));
  const oById = new Map(opts.map((o) => [o.id, o]));
  const aByQ = new Map(answers.map((a) => [a.questionId, a]));
  const labels = ["A", "B", "C", "D", "E", "F"];

  const out: ReviewQuestion[] = [];
  for (const qid of attempt.questionOrder) {
    const q = qById.get(qid);
    if (!q) continue;
    const a = aByQ.get(qid);
    const selected = a?.selectedOptionId ?? null;
    out.push({
      id: q.id,
      text: q.text,
      options: (attempt.optionOrder[qid] ?? [])
        .map((oid, i) => ({ o: oById.get(oid), i }))
        .filter((x): x is { o: NonNullable<typeof x.o>; i: number } => Boolean(x.o))
        .map(({ o, i }) => ({ id: o.id, label: labels[i] ?? String(i + 1), text: o.text })),
      selectedOptionId: selected,
      hintUsed: a?.hintUsed ?? false,
      hint: withAnswers ? q.hint : null,
      correctOptionId: withAnswers ? q.correctOptionId : null,
      explanation: withAnswers ? q.explanation : null,
      outcome: withAnswers ? answerOutcome({ selectedOptionId: selected, correctOptionId: q.correctOptionId }) : null,
    });
  }
  return out;
}

/** Question ids with their option ids, for building a new attempt's orders. */
export async function getQuestionOptionIds(testId: string): Promise<{ id: string; optionIds: string[] }[]> {
  const qs = await db.select({ id: questions.id }).from(questions).where(eq(questions.testId, testId)).orderBy(asc(questions.number));
  if (!qs.length) return [];
  const opts = await db
    .select({ id: questionOptions.id, questionId: questionOptions.questionId })
    .from(questionOptions)
    .where(sql`${questionOptions.questionId} in ${qs.map((q) => q.id)}`);
  const byQ = new Map<string, string[]>();
  for (const o of opts) byQ.set(o.questionId, [...(byQ.get(o.questionId) ?? []), o.id]);
  return qs.map((q) => ({ id: q.id, optionIds: byQ.get(q.id) ?? [] }));
}
