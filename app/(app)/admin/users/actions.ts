"use server";

import { and, count, eq, inArray, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  importJobs,
  importPreviews,
  users,
  type ImportPreviewRow,
  type ImportRowError,
  type ImportSummary,
  type UserRole,
} from "@/lib/db/schema";
import { MAX_UPLOAD_BYTES } from "@/lib/excel/cells";
import { parseUsersWorkbook, type ImportType } from "@/lib/excel/parse-users";
import { normalizeBatch, normalizeDepartment, normalizeEmail, normalizeLoginId, normalizeText } from "@/lib/normalize";
import {
  BCRYPT_COST_BULK,
  generateTemporaryPassword,
  hashPassword,
  passwordDiffersFromId,
  passwordSchema,
} from "@/lib/password";
import { actionUser } from "@/lib/permissions";
import { fail, ok, zodFields, type ActionResult } from "@/lib/result";
import { findUserById } from "@/lib/users";
import { userFormSchema } from "@/lib/validations/user";

const PREVIEW_TTL_MS = 30 * 60 * 1000;

// ===========================================================================
// Excel import — step 2 (preview)
// ===========================================================================
export type ImportPreviewData = {
  previewId: string;
  type: ImportType;
  fileName: string;
  summary: ImportSummary;
  errors: ImportRowError[]; // first 200
  sample: ImportPreviewRow[]; // first 20
};

export async function importUsersPreview(formData: FormData): Promise<ActionResult<ImportPreviewData>> {
  const { user, error } = await actionUser("ADMIN");
  if (!user) return error;

  const type = formData.get("type");
  if (type !== "FACULTY" && type !== "STUDENT") return fail("VALIDATION", "Choose Faculty or Students.");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("VALIDATION", "Choose an .xlsx file to upload.");
  if (!file.name.toLowerCase().endsWith(".xlsx")) return fail("VALIDATION", "Only .xlsx files are accepted.");
  if (file.size > MAX_UPLOAD_BYTES) return fail("VALIDATION", "The file is larger than 5 MB.");

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = await parseUsersWorkbook(buffer, type);
  } catch {
    return fail("VALIDATION", "Could not read the file. Please make sure it is a valid .xlsx workbook.");
  }

  const errors: ImportRowError[] = [...parsed.errors];
  const rows: ImportPreviewRow[] = [];

  if (parsed.rows.length) {
    const idKeys = parsed.rows.map((r) => r.loginId.toLowerCase());
    const emailKeys = parsed.rows.map((r) => r.email.toLowerCase());
    const existing = await db
      .select({ id: users.id, loginId: users.loginId, email: users.email, role: users.role })
      .from(users)
      .where(or(inArray(sql`lower(${users.loginId})`, idKeys), inArray(sql`lower(${users.email})`, emailKeys)));
    const byId = new Map(existing.map((u) => [u.loginId.toLowerCase(), u]));
    const byEmail = new Map(existing.map((u) => [u.email.toLowerCase(), u]));
    const compatible: UserRole[] = type === "FACULTY" ? ["FACULTY", "ADMIN"] : ["STUDENT"];
    const idLabel = type === "FACULTY" ? "Staff ID" : "Student ID";

    for (const r of parsed.rows) {
      const ex = byId.get(r.loginId.toLowerCase());
      const emailOwner = byEmail.get(r.email.toLowerCase());
      if (emailOwner && (!ex || emailOwner.id !== ex.id)) {
        errors.push({ row: r.row, column: "Email", message: `Email already belongs to user ${emailOwner.loginId}` });
        continue;
      }
      if (ex && !compatible.includes(ex.role)) {
        errors.push({ row: r.row, column: idLabel, message: `ID belongs to an existing ${ex.role.toLowerCase()} account` });
        continue;
      }
      if (!ex && !r.password) {
        errors.push({ row: r.row, column: "Password", message: "Password is required for a new user" });
        continue;
      }
      rows.push({ ...r, status: ex ? "update" : "create" });
    }
  }

  errors.sort((a, b) => a.row - b.row);
  const summary: ImportSummary = {
    total: parsed.total,
    toCreate: rows.filter((r) => r.status === "create").length,
    toUpdate: rows.filter((r) => r.status === "update").length,
    errorCount: errors.length,
  };

  const [preview] = await db
    .insert(importPreviews)
    .values({
      type,
      uploadedById: user.id,
      fileName: file.name,
      fileBase64: buffer.toString("base64"),
      rows: errors.length ? [] : rows, // nothing is committable when there are errors
      errors,
      summary,
      expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
    })
    .returning({ id: importPreviews.id });

  return ok({
    previewId: preview!.id,
    type,
    fileName: file.name,
    summary,
    errors: errors.slice(0, 200),
    sample: rows.slice(0, 20),
  });
}

// ===========================================================================
// Excel import — step 3 (commit)
// ===========================================================================
export async function importUsersCommit(previewId: string): Promise<ActionResult<{ created: number; updated: number }>> {
  const { user, error } = await actionUser("ADMIN");
  if (!user) return error;

  const preview = await db.query.importPreviews.findFirst({ where: eq(importPreviews.id, previewId) });
  if (!preview || preview.uploadedById !== user.id) return fail("NOT_FOUND", "Preview not found. Please upload the file again.");
  if (preview.expiresAt < new Date()) {
    await db.delete(importPreviews).where(eq(importPreviews.id, preview.id));
    return fail("VALIDATION", "This preview has expired. Please upload the file again.");
  }
  if (preview.summary.errorCount > 0 || preview.rows.length === 0) {
    return fail("VALIDATION", "Fix the errors in the file and upload it again.");
  }

  // Hash outside the transaction to keep it short.
  const hashes = new Map<number, string>();
  for (const r of preview.rows) {
    if (r.password) hashes.set(r.row, await hashPassword(r.password, BCRYPT_COST_BULK));
  }

  const role: UserRole = preview.type === "FACULTY" ? "FACULTY" : "STUDENT";
  let created = 0;
  let updated = 0;

  await db.transaction(async (tx) => {
    const toInsert: (typeof users.$inferInsert)[] = [];

    for (const r of preview.rows) {
      const hash = hashes.get(r.row);
      const common = {
        name: r.name,
        email: r.email,
        department: r.department,
        ...(preview.type === "FACULTY"
          ? { designation: r.designation ?? null }
          : { semester: r.semester ?? null, batch: r.batch ?? null, admissionYear: r.admissionYear ?? null }),
      };

      const [existing] = await tx
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.loginId}) = ${r.loginId.toLowerCase()}`)
        .limit(1);

      if (existing) {
        await tx
          .update(users)
          .set({
            ...common,
            ...(hash ? { passwordHash: hash, sessionVersion: sql`${users.sessionVersion} + 1` } : {}),
          })
          .where(eq(users.id, existing.id));
        updated++;
      } else {
        // The password from the file is the user's password until they change it (FR-AUTH-06).
        toInsert.push({ ...common, loginId: r.loginId, role, passwordHash: hash ?? null });
      }
    }

    for (let i = 0; i < toInsert.length; i += 100) {
      await tx.insert(users).values(toInsert.slice(i, i + 100));
    }
    created = toInsert.length;

    const [job] = await tx
      .insert(importJobs)
      .values({
        type: preview.type,
        uploadedById: user.id,
        fileName: preview.fileName,
        rowsCreated: created,
        rowsUpdated: updated,
      })
      .returning({ id: importJobs.id });
    await logAudit(
      {
        actorId: user.id,
        action: "user.import",
        entityType: "import_job",
        entityId: job!.id,
        after: { type: preview.type, fileName: preview.fileName, created, updated },
      },
      tx,
    );
    // TODO(Phase 2): archive preview.fileBase64 to R2 when configured (lib/storage.ts).
    await tx.delete(importPreviews).where(eq(importPreviews.id, preview.id));
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/imports");
  return ok({ created, updated });
}

// ===========================================================================
// Single-user form (create / edit)
// ===========================================================================
export type UserFormState = {
  ok?: boolean;
  id?: string;
  temporaryPassword?: string;
  error?: string;
  fields?: Record<string, string>;
};

export async function saveUserAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const { user: actor, error } = await actionUser("ADMIN");
  if (!actor) return { error: error.error.message };

  const id = String(formData.get("id") ?? "") || null;
  const role = String(formData.get("role") ?? "");
  const raw = {
    role,
    loginId: normalizeLoginId(formData.get("loginId")),
    name: normalizeText(formData.get("name")),
    email: normalizeEmail(formData.get("email")),
    department: normalizeDepartment(formData.get("department")),
    designation: normalizeText(formData.get("designation")),
    semester: String(formData.get("semester") ?? ""),
    batch: normalizeBatch(formData.get("batch")),
    admissionYear: String(formData.get("admissionYear") ?? ""),
  };
  const parsed = userFormSchema.safeParse(raw);
  if (!parsed.success) return { fields: zodFields(parsed.error.issues) };
  const data = parsed.data;

  const passwordMode = String(formData.get("passwordMode") ?? "keep"); // keep | generate | manual
  const manualPassword = String(formData.get("password") ?? "");
  let plainPassword: string | null = null;
  if (passwordMode === "generate" || (!id && passwordMode === "keep")) plainPassword = generateTemporaryPassword();
  if (passwordMode === "manual") {
    const p = passwordSchema.safeParse(manualPassword);
    if (!p.success) return { fields: { password: p.error.issues[0]?.message ?? "Invalid password" } };
    if (!passwordDiffersFromId(manualPassword, data.loginId)) return { fields: { password: "Password must not be the ID." } };
    plainPassword = manualPassword;
  }

  // Uniqueness (case-insensitive) against other users.
  const conflicts = await db
    .select({ id: users.id, loginId: users.loginId, email: users.email })
    .from(users)
    .where(
      and(
        or(sql`lower(${users.loginId}) = ${data.loginId.toLowerCase()}`, sql`lower(${users.email}) = ${data.email.toLowerCase()}`),
        id ? ne(users.id, id) : undefined,
      ),
    );
  const fields: Record<string, string> = {};
  for (const c of conflicts) {
    if (c.loginId.toLowerCase() === data.loginId.toLowerCase()) fields.loginId = "This ID is already in use.";
    if (c.email.toLowerCase() === data.email.toLowerCase()) fields.email = "This email is already in use.";
  }
  if (Object.keys(fields).length) return { fields };

  const values = {
    loginId: data.loginId,
    role: data.role,
    name: data.name,
    email: data.email,
    department: data.department,
    designation: data.role === "STUDENT" ? null : data.designation,
    semester: data.role === "STUDENT" ? data.semester : null,
    batch: data.role === "STUDENT" ? data.batch : null,
    admissionYear: data.role === "STUDENT" ? data.admissionYear : null,
  };
  const passwordHash = plainPassword ? await hashPassword(plainPassword) : null;

  if (!id) {
    const [row] = await db
      .insert(users)
      .values({ ...values, passwordHash })
      .returning({ id: users.id });
    await logAudit({ actorId: actor.id, action: "user.create", entityType: "user", entityId: row!.id, after: values });
    revalidatePath("/admin/users");
    return { ok: true, id: row!.id, temporaryPassword: plainPassword ?? undefined };
  }

  const before = await findUserById(id);
  if (!before) return { error: "User not found." };
  if (before.role === "ADMIN" && values.role !== "ADMIN" && !(await anotherActiveAdminExists(before.id))) {
    return { fields: { role: "Cannot remove the last active admin." } };
  }
  const roleChanged = before.role !== values.role;
  await db
    .update(users)
    .set({
      ...values,
      ...(passwordHash ? { passwordHash } : {}),
      ...(passwordHash || roleChanged ? { sessionVersion: sql`${users.sessionVersion} + 1` } : {}),
    })
    .where(eq(users.id, id));
  await logAudit({
    actorId: actor.id,
    action: "user.update",
    entityType: "user",
    entityId: id,
    before: pick(before),
    after: { ...values, ...(passwordHash ? { passwordReset: true } : {}) },
  });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  return { ok: true, id, temporaryPassword: plainPassword ?? undefined };
}

// ===========================================================================
// Account actions
// ===========================================================================
export async function setUserActiveAction(id: string, active: boolean): Promise<ActionResult<void>> {
  const { user: actor, error } = await actionUser("ADMIN");
  if (!actor) return error;
  const target = await findUserById(id);
  if (!target) return fail("NOT_FOUND", "User not found.");
  if (!active && target.id === actor.id) return fail("VALIDATION", "You cannot deactivate your own account.");
  if (!active && target.role === "ADMIN" && !(await anotherActiveAdminExists(target.id))) {
    return fail("VALIDATION", "Cannot deactivate the last active admin.");
  }
  await db
    .update(users)
    .set({ isActive: active, sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, id));
  await logAudit({
    actorId: actor.id,
    action: active ? "user.reactivate" : "user.deactivate",
    entityType: "user",
    entityId: id,
  });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  return ok(undefined);
}

export async function resetUserPasswordAction(
  id: string,
  manualPassword?: string,
): Promise<ActionResult<{ temporaryPassword: string }>> {
  const { user: actor, error } = await actionUser("ADMIN");
  if (!actor) return error;
  const target = await findUserById(id);
  if (!target) return fail("NOT_FOUND", "User not found.");

  let plain = manualPassword?.trim() || "";
  if (plain) {
    const p = passwordSchema.safeParse(plain);
    if (!p.success) return fail("VALIDATION", p.error.issues[0]?.message ?? "Invalid password", { password: "invalid" });
    if (!passwordDiffersFromId(plain, target.loginId)) return fail("VALIDATION", "Password must not be the ID.");
  } else {
    plain = generateTemporaryPassword();
  }

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(plain),
      sessionVersion: sql`${users.sessionVersion} + 1`, // logs the user out everywhere
    })
    .where(eq(users.id, id));
  await logAudit({ actorId: actor.id, action: "user.password_reset_admin", entityType: "user", entityId: id });
  return ok({ temporaryPassword: plain });
}

// ---------------------------------------------------------------------------
async function anotherActiveAdminExists(excludeId: string): Promise<boolean> {
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, "ADMIN"), eq(users.isActive, true), ne(users.id, excludeId)));
  return (row?.n ?? 0) > 0;
}

function pick(u: typeof users.$inferSelect) {
  return {
    loginId: u.loginId,
    role: u.role,
    name: u.name,
    email: u.email,
    department: u.department,
    designation: u.designation,
    semester: u.semester,
    batch: u.batch,
    admissionYear: u.admissionYear,
    isActive: u.isActive,
  };
}
