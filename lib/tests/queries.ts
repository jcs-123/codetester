import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { questionOptions, questions, testAssignments, testAttempts, tests, users, type Test } from "@/lib/db/schema";
import type { SessionUser } from "@/lib/permissions";
import { classFilter } from "@/lib/users";

const assignedCount = sql<number>`(select count(*)::int from ${testAssignments} where ${testAssignments.testId} = ${tests.id})`;
const attemptedCount = sql<number>`(select count(*)::int from ${testAttempts} where ${testAttempts.testId} = ${tests.id} and ${testAttempts.supersededAt} is null)`;
const submittedCount = sql<number>`(select count(*)::int from ${testAttempts} where ${testAttempts.testId} = ${tests.id} and ${testAttempts.supersededAt} is null and ${testAttempts.submittedAt} is not null)`;

export type TestListRow = {
  test: Test;
  assigned: number;
  attempted: number;
  submitted: number;
  createdByName: string | null;
};

export async function listTests(filter: { createdById?: string } = {}): Promise<TestListRow[]> {
  return db
    .select({ test: tests, assigned: assignedCount, attempted: attemptedCount, submitted: submittedCount, createdByName: users.name })
    .from(tests)
    .leftJoin(users, eq(users.id, tests.createdById))
    .where(and(isNull(tests.deletedAt), filter.createdById ? eq(tests.createdById, filter.createdById) : undefined))
    .orderBy(desc(tests.startsAt));
}

/** A test the user may see: admins see all, faculty only their own (FR-FAC scope). */
export async function getTestForUser(id: string, user: SessionUser): Promise<TestListRow | null> {
  const [row] = await db
    .select({ test: tests, assigned: assignedCount, attempted: attemptedCount, submitted: submittedCount, createdByName: users.name })
    .from(tests)
    .leftJoin(users, eq(users.id, tests.createdById))
    .where(and(eq(tests.id, id), isNull(tests.deletedAt)))
    .limit(1);
  if (!row) return null;
  if (user.role === "ADMIN") return row;
  if (user.role === "FACULTY" && row.test.createdById === user.id) return row;
  return null;
}

export function canManageTest(test: Test, user: SessionUser): boolean {
  return user.role === "FACULTY" && test.createdById === user.id;
}

export type QuestionWithOptions = {
  id: string;
  number: number;
  text: string;
  hint: string | null;
  explanation: string | null;
  correctOptionId: string | null;
  options: { id: string; label: string; text: string }[];
};

/** Questions in original order with options A–D (faculty / admin view, includes answers). */
export async function getTestQuestions(testId: string): Promise<QuestionWithOptions[]> {
  const qs = await db.select().from(questions).where(eq(questions.testId, testId)).orderBy(asc(questions.number));
  if (!qs.length) return [];
  const opts = await db
    .select()
    .from(questionOptions)
    .where(sql`${questionOptions.questionId} in ${qs.map((q) => q.id)}`)
    .orderBy(asc(questionOptions.label));
  const byQ = new Map<string, QuestionWithOptions["options"]>();
  for (const o of opts) {
    const arr = byQ.get(o.questionId) ?? [];
    arr.push({ id: o.id, label: o.label, text: o.text });
    byQ.set(o.questionId, arr);
  }
  return qs.map((q) => ({
    id: q.id,
    number: q.number,
    text: q.text,
    hint: q.hint,
    explanation: q.explanation,
    correctOptionId: q.correctOptionId,
    options: byQ.get(q.id) ?? [],
  }));
}

export type ClassOption = { department: string; semester: number; batch: string; students: number };

/** Distinct Department / Semester / Batch combinations of active students (FR-FAC-03). */
export async function listClasses(): Promise<ClassOption[]> {
  const rows = await db
    .select({ department: users.department, semester: users.semester, batch: users.batch, students: count() })
    .from(users)
    .where(and(eq(users.role, "STUDENT"), eq(users.isActive, true), isNull(users.deletedAt)))
    .groupBy(users.department, users.semester, users.batch)
    .orderBy(asc(users.department), asc(users.semester), asc(users.batch));
  return rows
    .filter((r): r is typeof r & { semester: number; batch: string } => r.semester !== null && r.batch !== null)
    .map((r) => ({ department: r.department, semester: r.semester, batch: r.batch, students: r.students }));
}

export async function listClassStudentIds(department: string, semester: number, batch: string): Promise<string[]> {
  const rows = await db.select({ id: users.id }).from(users).where(classFilter(department, semester, batch));
  return rows.map((r) => r.id);
}
