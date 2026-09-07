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
import { attemptStatus, summarize, type AttemptStatus, type ResultSummary } from "@/lib/tests/attempt-status";
import { answerOutcome, percentage, type AnswerOutcome } from "@/lib/tests/scoring";

export {
  ATTEMPT_STATUS_LABEL,
  attemptStatus,
  summarize,
  type AttemptStatus,
  type ResultSummary,
} from "@/lib/tests/attempt-status";

export type ResultRow = {
  studentId: string;
  loginId: string;
  name: string;
  batch: string | null;
  attempt: TestAttempt | null;
  status: AttemptStatus;
};

/** One row per assigned student with their live attempt (FR-RES-03). */
export async function listResults(testId: string): Promise<ResultRow[]> {
  const rows = await db
    .select({ studentId: users.id, loginId: users.loginId, name: users.name, batch: users.batch, attempt: testAttempts })
    .from(testAssignments)
    .innerJoin(users, eq(users.id, testAssignments.studentId))
    .leftJoin(
      testAttempts,
      and(eq(testAttempts.testId, testAssignments.testId), eq(testAttempts.studentId, users.id), isNull(testAttempts.supersededAt)),
    )
    .where(eq(testAssignments.testId, testId))
    .orderBy(asc(users.loginId));
  return rows.map((r) => ({ ...r, status: attemptStatus(r.attempt) }));
}

// ---------------------------------------------------------------------------
// One student's attempt, question by question, in the ORIGINAL order with
// original option letters (faculty view — FR-RES-05, export — §4.4).
// ---------------------------------------------------------------------------
export type AttemptDetailQuestion = {
  id: string;
  number: number;
  text: string;
  options: { id: string; label: string; text: string }[];
  chosenOptionId: string | null;
  chosenLabel: string | null;
  correctOptionId: string | null;
  correctLabel: string | null;
  outcome: AnswerOutcome;
  hintUsed: boolean;
  answeredAt: Date | null;
};

export type AttemptDetail = {
  attempt: TestAttempt;
  test: Test;
  student: { id: string; loginId: string; name: string; batch: string | null };
  questions: AttemptDetailQuestion[];
};

export async function getAttemptDetail(attemptId: string): Promise<AttemptDetail | null> {
  const [row] = await db
    .select({ attempt: testAttempts, test: tests, student: { id: users.id, loginId: users.loginId, name: users.name, batch: users.batch } })
    .from(testAttempts)
    .innerJoin(tests, eq(tests.id, testAttempts.testId))
    .innerJoin(users, eq(users.id, testAttempts.studentId))
    .where(eq(testAttempts.id, attemptId))
    .limit(1);
  if (!row) return null;
  const qs = await questionsWithOptions(row.test.id);
  const answers = await db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId));
  const aByQ = new Map(answers.map((a) => [a.questionId, a]));
  return {
    attempt: row.attempt,
    test: row.test,
    student: row.student,
    questions: qs.map((q) => detailFor(q, aByQ.get(q.id))),
  };
}

type QWithOpts = {
  id: string;
  number: number;
  text: string;
  correctOptionId: string | null;
  options: { id: string; label: string; text: string }[];
};

async function questionsWithOptions(testId: string): Promise<QWithOpts[]> {
  const qs = await db.select().from(questions).where(eq(questions.testId, testId)).orderBy(asc(questions.number));
  if (!qs.length) return [];
  const opts = await db
    .select()
    .from(questionOptions)
    .where(sql`${questionOptions.questionId} in ${qs.map((q) => q.id)}`)
    .orderBy(asc(questionOptions.label));
  const byQ = new Map<string, QWithOpts["options"]>();
  for (const o of opts) byQ.set(o.questionId, [...(byQ.get(o.questionId) ?? []), { id: o.id, label: o.label, text: o.text }]);
  return qs.map((q) => ({ id: q.id, number: q.number, text: q.text, correctOptionId: q.correctOptionId, options: byQ.get(q.id) ?? [] }));
}

function detailFor(
  q: QWithOpts,
  a: { selectedOptionId: string | null; hintUsed: boolean; answeredAt: Date } | undefined,
): AttemptDetailQuestion {
  const chosen = a?.selectedOptionId ?? null;
  const label = (id: string | null) => q.options.find((o) => o.id === id)?.label ?? null;
  return {
    id: q.id,
    number: q.number,
    text: q.text,
    options: q.options,
    chosenOptionId: chosen,
    chosenLabel: label(chosen),
    correctOptionId: q.correctOptionId,
    correctLabel: label(q.correctOptionId),
    outcome: answerOutcome({ selectedOptionId: chosen, correctOptionId: q.correctOptionId }),
    hintUsed: a?.hintUsed ?? false,
    answeredAt: a?.answeredAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// Export data (SRS §4.4)
// ---------------------------------------------------------------------------
export type ExportData = {
  test: Test;
  summaryRows: ResultRow[];
  summary: ResultSummary;
  responses: { row: ResultRow; questions: AttemptDetailQuestion[] }[];
};

export async function getExportData(test: Test): Promise<ExportData> {
  const rows = await listResults(test.id);
  const qs = await questionsWithOptions(test.id);
  const started = rows.filter((r) => r.attempt);
  const responses: ExportData["responses"] = [];
  if (started.length) {
    const answers = await db
      .select()
      .from(attemptAnswers)
      .where(sql`${attemptAnswers.attemptId} in ${started.map((r) => r.attempt!.id)}`);
    const byAttempt = new Map<string, Map<string, (typeof answers)[number]>>();
    for (const a of answers) {
      const m = byAttempt.get(a.attemptId) ?? new Map();
      m.set(a.questionId, a);
      byAttempt.set(a.attemptId, m);
    }
    for (const r of started) {
      const m = byAttempt.get(r.attempt!.id);
      responses.push({ row: r, questions: qs.map((q) => detailFor(q, m?.get(q.id))) });
    }
  }
  return { test, summaryRows: rows, summary: summarize(rows, test.questionCount), responses };
}

export function scorePercent(a: TestAttempt | null): number | null {
  if (!a?.submittedAt) return null;
  return percentage(a.score ?? 0, a.totalQuestions ?? 0);
}
