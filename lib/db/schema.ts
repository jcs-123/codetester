import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const userRoleEnum = pgEnum("user_role", ["ADMIN", "FACULTY", "STUDENT"]);
export const showAnswersEnum = pgEnum("show_answers", ["AFTER_END", "IMMEDIATELY"]);
export const submitTypeEnum = pgEnum("submit_type", ["MANUAL", "TIMEOUT", "CLOSED"]);
export const assignmentSourceEnum = pgEnum("assignment_source", ["CREATION", "RESYNC"]);
export const importTypeEnum = pgEnum("import_type", ["FACULTY", "STUDENT"]);

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type ShowAnswers = (typeof showAnswersEnum.enumValues)[number];
export type SubmitType = (typeof submitTypeEnum.enumValues)[number];

// ---------------------------------------------------------------------------
// Column helpers
// ---------------------------------------------------------------------------
const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () =>
  ts("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------------------------------------------------------------------------
// users — shared platform table (SRS §7.2)
// ---------------------------------------------------------------------------
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loginId: text("login_id").notNull(), // staff ID or student ID
    role: userRoleEnum("role").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    department: text("department").notNull(),
    designation: text("designation"), // faculty only
    semester: integer("semester"), // students only
    batch: text("batch"), // students only — section/division
    admissionYear: integer("admission_year"), // students only
    passwordHash: text("password_hash"), // null => Google-only account
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    sessionVersion: integer("session_version").notNull().default(1),
    lastLoginAt: ts("last_login_at"),
    deletedAt: ts("deleted_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_login_id_lower_uq").on(sql`lower(${t.loginId})`),
    uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`),
    index("users_role_idx").on(t.role),
    index("users_class_idx").on(t.department, t.semester, t.batch),
  ],
);

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------
export const tests = pgTable(
  "tests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    subjectCode: text("subject_code").notNull(),
    subjectName: text("subject_name").notNull(),
    department: text("department").notNull(),
    semester: integer("semester").notNull(),
    batch: text("batch").notNull(),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    instructions: text("instructions"),
    showAnswers: showAnswersEnum("show_answers").notNull().default("AFTER_END"),
    questionCount: integer("question_count").notNull().default(0),
    closedAt: ts("closed_at"),
    closedById: uuid("closed_by_id").references(() => users.id),
    questionFileKey: text("question_file_key"), // R2 object key of archived upload
    deletedAt: ts("deleted_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tests_created_by_idx").on(t.createdById),
    index("tests_class_idx").on(t.department, t.semester, t.batch),
    index("tests_window_idx").on(t.startsAt, t.endsAt),
  ],
);

// ---------------------------------------------------------------------------
// questions / question_options
// ---------------------------------------------------------------------------
export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    testId: uuid("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    number: integer("number").notNull(), // original "Question No" from the file
    text: text("text").notNull(),
    hint: text("hint"),
    explanation: text("explanation"),
    // Nullable only because options are inserted after the question row;
    // application code always sets it before the test becomes visible.
    correctOptionId: uuid("correct_option_id").references(
      (): AnyPgColumn => questionOptions.id,
      { onDelete: "set null" },
    ),
  },
  (t) => [uniqueIndex("questions_test_number_uq").on(t.testId, t.number)],
);

export const questionOptions = pgTable(
  "question_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    label: char("label", { length: 1 }).notNull(), // original letter A–D
    text: text("text").notNull(),
  },
  (t) => [uniqueIndex("question_options_question_label_uq").on(t.questionId, t.label)],
);

// ---------------------------------------------------------------------------
// test_assignments
// ---------------------------------------------------------------------------
export const testAssignments = pgTable(
  "test_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    testId: uuid("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    source: assignmentSourceEnum("source").notNull().default("CREATION"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("test_assignments_test_student_uq").on(t.testId, t.studentId),
    index("test_assignments_student_idx").on(t.studentId),
  ],
);

// ---------------------------------------------------------------------------
// test_attempts
// ---------------------------------------------------------------------------
export const testAttempts = pgTable(
  "test_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    testId: uuid("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    startedAt: ts("started_at").notNull(),
    deadlineAt: ts("deadline_at").notNull(), // min(startedAt + duration, test.endsAt)
    submittedAt: ts("submitted_at"),
    submitType: submitTypeEnum("submit_type"),
    questionOrder: jsonb("question_order").$type<string[]>().notNull(),
    optionOrder: jsonb("option_order").$type<Record<string, string[]>>().notNull(),
    score: integer("score"),
    totalQuestions: integer("total_questions"),
    hintsUsed: integer("hints_used").notNull().default(0),
    // Set when a faculty member resets the attempt; the row is kept for audit.
    supersededAt: ts("superseded_at"),
    resetById: uuid("reset_by_id").references(() => users.id),
    resetReason: text("reset_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // One live attempt per student per test.
    uniqueIndex("test_attempts_live_uq")
      .on(t.testId, t.studentId)
      .where(sql`${t.supersededAt} is null`),
    index("test_attempts_student_idx").on(t.studentId),
    index("test_attempts_open_idx")
      .on(t.deadlineAt)
      .where(sql`${t.submittedAt} is null and ${t.supersededAt} is null`),
  ],
);

// ---------------------------------------------------------------------------
// attempt_answers
// ---------------------------------------------------------------------------
export const attemptAnswers = pgTable(
  "attempt_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => testAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    selectedOptionId: uuid("selected_option_id").references(() => questionOptions.id, {
      onDelete: "set null",
    }),
    hintUsed: boolean("hint_used").notNull().default(false),
    answeredAt: ts("answered_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("attempt_answers_attempt_question_uq").on(t.attemptId, t.questionId)],
);

// ---------------------------------------------------------------------------
// Supporting tables
// ---------------------------------------------------------------------------
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(), // sha256 of the raw token
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("password_reset_tokens_hash_uq").on(t.tokenHash)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loginId: text("login_id").notNull(), // lower-cased
    ip: text("ip"),
    succeeded: boolean("succeeded").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_login_created_idx").on(t.loginId, t.createdAt)],
);

/** Parsed rows held between the preview and commit steps of the import wizard (FR-ADM-04). */
export const importPreviews = pgTable(
  "import_previews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: importTypeEnum("type").notNull(),
    uploadedById: uuid("uploaded_by_id")
      .notNull()
      .references(() => users.id),
    fileName: text("file_name").notNull(),
    fileBase64: text("file_base64"), // original upload, archived on commit
    rows: jsonb("rows").$type<ImportPreviewRow[]>().notNull(),
    errors: jsonb("errors").$type<ImportRowError[]>().notNull(),
    summary: jsonb("summary").$type<ImportSummary>().notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("import_previews_expires_idx").on(t.expiresAt)],
);

export type ImportRowError = { row: number; column: string; message: string };
export type ImportSummary = { total: number; toCreate: number; toUpdate: number; errorCount: number };
export type ImportPreviewRow = {
  row: number;
  status: "create" | "update";
  loginId: string;
  name: string;
  email: string;
  department: string;
  designation?: string;
  semester?: number;
  batch?: string;
  admissionYear?: number;
  /** present only when the Password cell was filled */
  password?: string;
};

/** A parsed question file waiting for the faculty member to press "Create test" (FR-FAC-06). */
export const questionFilePreviews = pgTable(
  "question_file_previews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    uploadedById: uuid("uploaded_by_id")
      .notNull()
      .references(() => users.id),
    fileName: text("file_name").notNull(),
    fileBase64: text("file_base64"),
    questions: jsonb("questions").$type<QuestionFileRow[]>().notNull(),
    errors: jsonb("errors").$type<ImportRowError[]>().notNull(),
    total: integer("total").notNull().default(0),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("question_file_previews_expires_idx").on(t.expiresAt)],
);

export type QuestionFileRow = {
  row: number;
  number: number;
  text: string;
  options: { label: string; text: string }[];
  hint?: string;
  answer: string;
  explanation?: string;
};

export const importJobs = pgTable("import_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: importTypeEnum("type").notNull(),
  uploadedById: uuid("uploaded_by_id")
    .notNull()
    .references(() => users.id),
  fileName: text("file_name").notNull(),
  fileKey: text("file_key"), // R2 object key
  rowsCreated: integer("rows_created").notNull().default(0),
  rowsUpdated: integer("rows_updated").notNull().default(0),
  createdAt: createdAt(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").notNull(), // e.g. "test.create", "user.import", "attempt.reset"
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before").$type<Record<string, unknown> | null>(),
    after: jsonb("after").$type<Record<string, unknown> | null>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entityType, t.entityId)],
);

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Test = typeof tests.$inferSelect;
export type NewTest = typeof tests.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type QuestionOption = typeof questionOptions.$inferSelect;
export type TestAttempt = typeof testAttempts.$inferSelect;
export type AttemptAnswer = typeof attemptAnswers.$inferSelect;
