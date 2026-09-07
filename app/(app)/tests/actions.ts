"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  questionFilePreviews,
  questionOptions,
  questions,
  testAssignments,
  testAttempts,
  tests,
  type ImportRowError,
  type QuestionFileRow,
} from "@/lib/db/schema";
import { MAX_UPLOAD_BYTES } from "@/lib/excel/cells";
import { parseQuestionsWorkbook } from "@/lib/excel/parse-questions";
import { normalizeBatch, normalizeDepartment, normalizeText } from "@/lib/normalize";
import { actionUser } from "@/lib/permissions";
import { fail, ok, zodFields, type ActionResult } from "@/lib/result";
import { finalizeOpenAttempts } from "@/lib/tests/attempts";
import { getTestForUser, listClassStudentIds } from "@/lib/tests/queries";
import { computeDeadline, testStatus } from "@/lib/tests/status";
import { fromDateTimeLocalValue } from "@/lib/time";
import { testFormSchema } from "@/lib/validations/test";

const PREVIEW_TTL_MS = 30 * 60 * 1000;
const START_TOLERANCE_MS = 2 * 60 * 1000;

// ===========================================================================
// Question file: parse + preview (FR-FAC-04..06)
// ===========================================================================
export type QuestionPreviewData = {
  previewId: string;
  fileName: string;
  questions: QuestionFileRow[];
  errors: ImportRowError[];
  total: number;
};

export async function parseQuestionFileAction(formData: FormData): Promise<ActionResult<QuestionPreviewData>> {
  const { user, error } = await actionUser("FACULTY");
  if (!user) return error;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("VALIDATION", "Choose an .xlsx question file.");
  if (!file.name.toLowerCase().endsWith(".xlsx")) return fail("VALIDATION", "Only .xlsx files are accepted.");
  if (file.size > MAX_UPLOAD_BYTES) return fail("VALIDATION", "The file is larger than 5 MB.");

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = await parseQuestionsWorkbook(buffer);
  } catch {
    return fail("VALIDATION", "Could not read the file. Please make sure it is a valid .xlsx workbook.");
  }

  const [preview] = await db
    .insert(questionFilePreviews)
    .values({
      uploadedById: user.id,
      fileName: file.name,
      fileBase64: buffer.toString("base64"),
      questions: parsed.errors.length ? [] : parsed.questions,
      errors: parsed.errors,
      total: parsed.total,
      expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
    })
    .returning({ id: questionFilePreviews.id });

  return ok({
    previewId: preview!.id,
    fileName: file.name,
    questions: parsed.errors.length ? [] : parsed.questions,
    errors: parsed.errors,
    total: parsed.total,
  });
}

// ===========================================================================
// Create / edit test (FR-FAC-02, 07, 08, 10)
// ===========================================================================
export type TestFormState = { error?: string; fields?: Record<string, string> };

export async function saveTestAction(_prev: TestFormState, formData: FormData): Promise<TestFormState> {
  const { user, error } = await actionUser("FACULTY");
  if (!user) return { error: error.error.message };

  const id = String(formData.get("id") ?? "") || null;
  const previewId = String(formData.get("previewId") ?? "") || null;

  const parsed = testFormSchema.safeParse({
    name: normalizeText(formData.get("name")),
    subjectCode: normalizeText(formData.get("subjectCode")).toUpperCase(),
    subjectName: normalizeText(formData.get("subjectName")),
    department: normalizeDepartment(formData.get("department")),
    semester: String(formData.get("semester") ?? ""),
    batch: normalizeBatch(formData.get("batch")),
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
    durationMinutes: String(formData.get("durationMinutes") ?? ""),
    instructions: String(formData.get("instructions") ?? ""),
    showAnswers: String(formData.get("showAnswers") ?? "AFTER_END"),
  });
  if (!parsed.success) return { fields: zodFields(parsed.error.issues) };
  const d = parsed.data;

  const fields: Record<string, string> = {};
  const startsAt = fromDateTimeLocalValue(d.startsAt);
  const endsAt = fromDateTimeLocalValue(d.endsAt);
  const now = new Date();
  if (!startsAt) fields.startsAt = "Enter a valid start date and time.";
  if (!endsAt) fields.endsAt = "Enter a valid end date and time.";
  if (startsAt && endsAt) {
    if (endsAt <= startsAt) fields.endsAt = "End must be after start.";
    else if ((endsAt.getTime() - startsAt.getTime()) / 60_000 < d.durationMinutes) {
      fields.durationMinutes = "Duration cannot be longer than the window between start and end.";
    }
    if (startsAt.getTime() < now.getTime() - START_TOLERANCE_MS) fields.startsAt = "Start must be now or later.";
  }

  // Existing test (edit) — only while Scheduled and owned by this faculty member.
  const existing = id ? await getTestForUser(id, user) : null;
  if (id && (!existing || existing.test.createdById !== user.id)) return { error: "Test not found." };
  if (existing && testStatus(existing.test) !== "SCHEDULED") {
    return { error: "This test has already started. Only the end time can be changed now." };
  }

  // Question file preview (required on create, optional on edit).
  let preview: typeof questionFilePreviews.$inferSelect | undefined;
  if (previewId) {
    preview = await db.query.questionFilePreviews.findFirst({ where: eq(questionFilePreviews.id, previewId) });
    if (!preview || preview.uploadedById !== user.id || preview.expiresAt < now) {
      fields.questionFile = "The checked question file has expired. Please check the file again.";
    } else if (preview.errors.length || preview.questions.length === 0) {
      fields.questionFile = "The question file has errors. Fix them and check the file again.";
    }
  } else if (!existing) {
    fields.questionFile = "Upload and check a question file.";
  }

  const studentIds = await listClassStudentIds(d.department, d.semester, d.batch);
  if (studentIds.length === 0) fields.batch = "No active students match this department, semester and batch.";

  if (Object.keys(fields).length) return { fields };

  const values = {
    name: d.name,
    subjectCode: d.subjectCode,
    subjectName: d.subjectName,
    department: d.department,
    semester: d.semester,
    batch: d.batch,
    startsAt: startsAt!,
    endsAt: endsAt!,
    durationMinutes: d.durationMinutes,
    instructions: d.instructions || null,
    showAnswers: d.showAnswers,
  };

  const testId = await db.transaction(async (tx) => {
    let tid = id;
    if (!tid) {
      const [row] = await tx
        .insert(tests)
        .values({ ...values, createdById: user.id, questionCount: preview!.questions.length })
        .returning({ id: tests.id });
      tid = row!.id;
    } else {
      await tx
        .update(tests)
        .set({ ...values, ...(preview ? { questionCount: preview.questions.length } : {}) })
        .where(eq(tests.id, tid));
      if (preview) await tx.delete(questions).where(eq(questions.testId, tid));
      await tx.delete(testAssignments).where(eq(testAssignments.testId, tid));
    }

    if (preview) {
      await insertQuestions(tx, tid, preview.questions);
      await tx.update(questionFilePreviews).set({ expiresAt: new Date(0) }).where(eq(questionFilePreviews.id, preview.id));
      // TODO(R2): archive preview.fileBase64 as tests.questionFileKey when storage is configured.
    }

    await tx.insert(testAssignments).values(studentIds.map((studentId) => ({ testId: tid!, studentId, source: "CREATION" as const })));

    await logAudit(
      {
        actorId: user.id,
        action: id ? "test.update" : "test.create",
        entityType: "test",
        entityId: tid,
        before: existing ? summarize(existing.test) : null,
        after: { ...summarize({ ...values, questionCount: preview?.questions.length ?? existing?.test.questionCount ?? 0 }), assigned: studentIds.length },
      },
      tx,
    );
    return tid!;
  });

  revalidatePath("/tests");
  revalidatePath(`/tests/${testId}`);
  redirect(`/tests/${testId}`);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function insertQuestions(tx: Tx, testId: string, rows: QuestionFileRow[]) {
  const inserted = await tx
    .insert(questions)
    .values(rows.map((q) => ({ testId, number: q.number, text: q.text, hint: q.hint ?? null, explanation: q.explanation ?? null })))
    .returning({ id: questions.id, number: questions.number });
  const idByNumber = new Map(inserted.map((q) => [q.number, q.id]));

  const optionRows = rows.flatMap((q) =>
    q.options.map((o) => ({ questionId: idByNumber.get(q.number)!, label: o.label, text: o.text })),
  );
  const insertedOptions: { id: string; questionId: string; label: string }[] = [];
  for (let i = 0; i < optionRows.length; i += 200) {
    insertedOptions.push(
      ...(await tx
        .insert(questionOptions)
        .values(optionRows.slice(i, i + 200))
        .returning({ id: questionOptions.id, questionId: questionOptions.questionId, label: questionOptions.label })),
    );
  }
  const optionId = new Map(insertedOptions.map((o) => [`${o.questionId}:${o.label}`, o.id]));
  for (const q of rows) {
    const qid = idByNumber.get(q.number)!;
    await tx.update(questions).set({ correctOptionId: optionId.get(`${qid}:${q.answer}`)! }).where(eq(questions.id, qid));
  }
}

function summarize(t: {
  name: string;
  subjectCode: string;
  department: string;
  semester: number;
  batch: string;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  showAnswers: string;
  questionCount: number;
}) {
  return {
    name: t.name,
    subjectCode: t.subjectCode,
    class: `${t.department}/${t.semester}/${t.batch}`,
    startsAt: t.startsAt.toISOString(),
    endsAt: t.endsAt.toISOString(),
    durationMinutes: t.durationMinutes,
    showAnswers: t.showAnswers,
    questionCount: t.questionCount,
  };
}

// ===========================================================================
// Lifecycle actions (FR-FAC-09, 10, 11)
// ===========================================================================
export async function deleteTestAction(id: string): Promise<ActionResult<void>> {
  const { user, error } = await actionUser("FACULTY");
  if (!user) return error;
  const row = await getTestForUser(id, user);
  if (!row || row.test.createdById !== user.id) return fail("NOT_FOUND", "Test not found.");
  if (testStatus(row.test) !== "SCHEDULED") return fail("TEST_STARTED", "A test that has started cannot be deleted.");
  await db.update(tests).set({ deletedAt: new Date() }).where(eq(tests.id, id));
  await logAudit({ actorId: user.id, action: "test.delete", entityType: "test", entityId: id, before: summarize(row.test) });
  revalidatePath("/tests");
  return ok(undefined);
}

export async function closeTestAction(id: string): Promise<ActionResult<{ finalized: number }>> {
  const { user, error } = await actionUser("FACULTY");
  if (!user) return error;
  const row = await getTestForUser(id, user);
  if (!row || row.test.createdById !== user.id) return fail("NOT_FOUND", "Test not found.");
  if (testStatus(row.test) !== "LIVE") return fail("TEST_NOT_LIVE", "Only a live test can be closed.");

  const finalized = await db.transaction(async (tx) => {
    await tx.update(tests).set({ closedAt: new Date(), closedById: user.id }).where(eq(tests.id, id));
    const n = await finalizeOpenAttempts(tx, id, "CLOSED");
    await logAudit({ actorId: user.id, action: "test.close", entityType: "test", entityId: id, after: { finalized: n } }, tx);
    return n;
  });
  revalidatePath("/tests");
  revalidatePath(`/tests/${id}`);
  return ok({ finalized });
}

export async function extendTestAction(id: string, newEndLocal: string): Promise<ActionResult<void>> {
  const { user, error } = await actionUser("FACULTY");
  if (!user) return error;
  const row = await getTestForUser(id, user);
  if (!row || row.test.createdById !== user.id) return fail("NOT_FOUND", "Test not found.");
  if (testStatus(row.test) !== "LIVE") return fail("TEST_NOT_LIVE", "Only a live test can be extended.");

  const newEnd = fromDateTimeLocalValue(newEndLocal);
  if (!newEnd) return fail("VALIDATION", "Enter a valid date and time.");
  if (newEnd <= row.test.endsAt) return fail("VALIDATION", "The new end time must be later than the current end time.");
  if (newEnd.getTime() - row.test.endsAt.getTime() > 24 * 60 * 60 * 1000) {
    return fail("VALIDATION", "A test can be extended by at most 24 hours at a time.");
  }

  const oldEnd = row.test.endsAt;
  await db.transaction(async (tx) => {
    await tx.update(tests).set({ endsAt: newEnd }).where(eq(tests.id, id));
    // Attempts that were capped by the old end time get the extra time (SRS §7.5), still limited by duration.
    const capped = await tx
      .select({ id: testAttempts.id, startedAt: testAttempts.startedAt })
      .from(testAttempts)
      .where(
        and(
          eq(testAttempts.testId, id),
          isNull(testAttempts.submittedAt),
          isNull(testAttempts.supersededAt),
          eq(testAttempts.deadlineAt, oldEnd),
        ),
      );
    for (const a of capped) {
      await tx
        .update(testAttempts)
        .set({ deadlineAt: computeDeadline(a.startedAt, row.test.durationMinutes, newEnd) })
        .where(eq(testAttempts.id, a.id));
    }
    await logAudit(
      {
        actorId: user.id,
        action: "test.extend",
        entityType: "test",
        entityId: id,
        before: { endsAt: oldEnd.toISOString() },
        after: { endsAt: newEnd.toISOString(), attemptsExtended: capped.length },
      },
      tx,
    );
  });
  revalidatePath(`/tests/${id}`);
  return ok(undefined);
}

export async function resyncAssignmentsAction(id: string): Promise<ActionResult<{ added: number }>> {
  const { user, error } = await actionUser("FACULTY");
  if (!user) return error;
  const row = await getTestForUser(id, user);
  if (!row || row.test.createdById !== user.id) return fail("NOT_FOUND", "Test not found.");
  if (testStatus(row.test) === "CLOSED") return fail("TEST_NOT_LIVE", "The test has ended.");

  const ids = await listClassStudentIds(row.test.department, row.test.semester, row.test.batch);
  const existing = await db.select({ studentId: testAssignments.studentId }).from(testAssignments).where(eq(testAssignments.testId, id));
  const have = new Set(existing.map((e) => e.studentId));
  const missing = ids.filter((s) => !have.has(s));
  if (missing.length) {
    await db
      .insert(testAssignments)
      .values(missing.map((studentId) => ({ testId: id, studentId, source: "RESYNC" as const })))
      .onConflictDoNothing();
    await logAudit({ actorId: user.id, action: "test.resync", entityType: "test", entityId: id, after: { added: missing.length } });
  }
  revalidatePath(`/tests/${id}`);
  return ok({ added: missing.length });
}

/** FR-RES-07: archive a student's attempt so they can start again. */
export async function resetAttemptAction(attemptId: string, reason: string): Promise<ActionResult<void>> {
  const { user, error } = await actionUser("FACULTY");
  if (!user) return error;
  const trimmed = reason.trim();
  if (trimmed.length < 3) return fail("VALIDATION", "Please give a short reason for the reset.");

  const [attempt] = await db.select().from(testAttempts).where(eq(testAttempts.id, attemptId)).limit(1);
  if (!attempt || attempt.supersededAt) return fail("NOT_FOUND", "Attempt not found.");
  const row = await getTestForUser(attempt.testId, user);
  if (!row || row.test.createdById !== user.id) return fail("NOT_FOUND", "Test not found.");
  if (testStatus(row.test) !== "LIVE") return fail("TEST_NOT_LIVE", "Attempts can only be reset while the test is live.");

  await db.transaction(async (tx) => {
    await tx
      .update(testAttempts)
      .set({ supersededAt: new Date(), resetById: user.id, resetReason: trimmed.slice(0, 500) })
      .where(eq(testAttempts.id, attemptId));
    await logAudit(
      {
        actorId: user.id,
        action: "attempt.reset",
        entityType: "test_attempt",
        entityId: attemptId,
        before: { studentId: attempt.studentId, score: attempt.score, submittedAt: attempt.submittedAt?.toISOString() ?? null },
        after: { reason: trimmed },
      },
      tx,
    );
  });
  revalidatePath(`/tests/${attempt.testId}/results`);
  return ok(undefined);
}

/** Used by pages to prune stale previews opportunistically. */
export async function purgeExpiredPreviews(): Promise<void> {
  await db.delete(questionFilePreviews).where(sql`${questionFilePreviews.expiresAt} < now() - interval '1 day'`);
}
