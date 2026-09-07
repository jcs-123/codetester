import { z } from "zod";

import type { ImportRowError } from "@/lib/db/schema";
import { headerKey, readFirstSheet } from "@/lib/excel/cells";
import { normalizeBatch, normalizeDepartment, normalizeEmail, normalizeLoginId, normalizeText } from "@/lib/normalize";
import { passwordSchema } from "@/lib/password";
import { facultyFieldsSchema, studentFieldsSchema, userBaseSchema } from "@/lib/validations/user";

export type ImportType = "FACULTY" | "STUDENT";

export type ParsedUserRow = {
  row: number;
  loginId: string;
  name: string;
  email: string;
  department: string;
  designation?: string;
  semester?: number;
  batch?: string;
  admissionYear?: number;
  password?: string;
};

export type ParseUsersResult = { rows: ParsedUserRow[]; errors: ImportRowError[]; total: number };

export const MAX_IMPORT_ROWS = 5000;

/** Template column headers (SRS §4.1 / §4.2), in order. */
export const FACULTY_COLUMNS = ["Staff ID", "Name", "Email", "Department", "Designation", "Password"] as const;
export const STUDENT_COLUMNS = [
  "Student ID",
  "Name",
  "Email",
  "Department",
  "Semester",
  "Batch",
  "Admission Year",
  "Password",
] as const;

type FieldKey = keyof ParsedUserRow;

const FACULTY_MAP: Record<string, FieldKey> = {
  staffid: "loginId",
  name: "name",
  email: "email",
  department: "department",
  designation: "designation",
  password: "password",
};
const STUDENT_MAP: Record<string, FieldKey> = {
  studentid: "loginId",
  name: "name",
  email: "email",
  department: "department",
  semester: "semester",
  batch: "batch",
  admissionyear: "admissionYear",
  password: "password",
};

const facultyRowSchema = userBaseSchema.extend(facultyFieldsSchema.shape);
const studentRowSchema = userBaseSchema.extend(studentFieldsSchema.shape);

export async function parseUsersWorkbook(data: ArrayBuffer | Buffer, type: ImportType): Promise<ParseUsersResult> {
  const errors: ImportRowError[] = [];
  const { header, rows } = await readFirstSheet(data);

  const expected = type === "FACULTY" ? FACULTY_COLUMNS : STUDENT_COLUMNS;
  const map = type === "FACULTY" ? FACULTY_MAP : STUDENT_MAP;

  // Header -> column index
  const colIndex = new Map<FieldKey, number>();
  header.forEach((h, i) => {
    const field = map[headerKey(h)];
    if (field && !colIndex.has(field)) colIndex.set(field, i);
  });
  const missing = expected.filter((h) => !colIndex.has(map[headerKey(h)]!) && headerKey(h) !== "password");
  if (missing.length) {
    errors.push({ row: 1, column: "Header", message: `Missing column(s): ${missing.join(", ")}` });
    return { rows: [], errors, total: rows.length };
  }
  if (rows.length === 0) {
    errors.push({ row: 2, column: "—", message: "The file has no data rows." });
    return { rows: [], errors, total: 0 };
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    errors.push({ row: 2, column: "—", message: `Too many rows (${rows.length}). Maximum is ${MAX_IMPORT_ROWS}.` });
    return { rows: [], errors, total: rows.length };
  }

  const get = (cells: string[], f: FieldKey) => {
    const i = colIndex.get(f);
    return i === undefined ? "" : (cells[i] ?? "");
  };

  const parsed: ParsedUserRow[] = [];
  const seenIds = new Map<string, number>();
  const seenEmails = new Map<string, number>();

  for (const r of rows) {
    const raw = {
      loginId: normalizeLoginId(get(r.cells, "loginId")),
      name: normalizeText(get(r.cells, "name")),
      email: normalizeEmail(get(r.cells, "email")),
      department: normalizeDepartment(get(r.cells, "department")),
      designation: normalizeText(get(r.cells, "designation")),
      semester: get(r.cells, "semester"),
      batch: normalizeBatch(get(r.cells, "batch")),
      admissionYear: get(r.cells, "admissionYear"),
    };
    const password = get(r.cells, "password");

    const result =
      type === "FACULTY"
        ? facultyRowSchema.safeParse({ ...raw, designation: raw.designation })
        : studentRowSchema.safeParse(raw);

    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = String(issue.path[0] ?? "");
        errors.push({ row: r.n, column: columnLabel(type, field), message: issue.message });
      }
      continue;
    }

    if (password) {
      const p = passwordSchema.safeParse(password);
      if (!p.success) {
        errors.push({ row: r.n, column: "Password", message: p.error.issues[0]?.message ?? "Invalid password" });
        continue;
      }
      if (password.trim().toLowerCase() === result.data.loginId.toLowerCase()) {
        errors.push({ row: r.n, column: "Password", message: "Password must not equal the ID" });
        continue;
      }
    }

    const idKey = result.data.loginId.toLowerCase();
    const emailKey = result.data.email.toLowerCase();
    const dupId = seenIds.get(idKey);
    const dupEmail = seenEmails.get(emailKey);
    if (dupId) {
      errors.push({ row: r.n, column: columnLabel(type, "loginId"), message: `Duplicate ID — also on row ${dupId}` });
      continue;
    }
    if (dupEmail) {
      errors.push({ row: r.n, column: "Email", message: `Duplicate email — also on row ${dupEmail}` });
      continue;
    }
    seenIds.set(idKey, r.n);
    seenEmails.set(emailKey, r.n);

    const d = result.data as z.infer<typeof facultyRowSchema> & Partial<z.infer<typeof studentRowSchema>>;
    parsed.push({
      row: r.n,
      loginId: d.loginId,
      name: d.name,
      email: d.email,
      department: d.department,
      ...(type === "FACULTY"
        ? { designation: d.designation }
        : { semester: d.semester, batch: d.batch, admissionYear: d.admissionYear }),
      ...(password ? { password } : {}),
    });
  }

  return { rows: parsed, errors, total: rows.length };
}

function columnLabel(type: ImportType, field: string): string {
  const labels: Record<string, string> = {
    loginId: type === "FACULTY" ? "Staff ID" : "Student ID",
    name: "Name",
    email: "Email",
    department: "Department",
    designation: "Designation",
    semester: "Semester",
    batch: "Batch",
    admissionYear: "Admission Year",
    password: "Password",
  };
  return labels[field] ?? field;
}
