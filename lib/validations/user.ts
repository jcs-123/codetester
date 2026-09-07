import { z } from "zod";

export const LOGIN_ID_RE = /^[A-Za-z0-9.\-]{1,30}$/;

const trimmed = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

export const userBaseSchema = z.object({
  loginId: z
    .string()
    .trim()
    .min(1, "ID is required")
    .regex(LOGIN_ID_RE, "ID may contain letters, digits, dots and hyphens (max 30)"),
  name: trimmed(100, "Name"),
  email: z.email("Enter a valid email address").max(200),
  department: trimmed(60, "Department"),
});

export const facultyFieldsSchema = z.object({
  designation: trimmed(60, "Designation"),
});

export const studentFieldsSchema = z.object({
  semester: z.coerce.number().int("Semester must be a whole number").min(1, "Semester must be 1–8").max(8, "Semester must be 1–8"),
  batch: trimmed(20, "Batch"),
  admissionYear: z.coerce
    .number()
    .int("Admission year must be a whole number")
    .min(2000, "Admission year must be between 2000 and 2099")
    .max(2099, "Admission year must be between 2000 and 2099"),
});

export const roleSchema = z.enum(["ADMIN", "FACULTY", "STUDENT"]);

/** Admin "create / edit user" form. */
export const userFormSchema = z.discriminatedUnion("role", [
  userBaseSchema.extend({ role: z.literal("STUDENT") }).extend(studentFieldsSchema.shape),
  userBaseSchema.extend({ role: z.literal("FACULTY") }).extend(facultyFieldsSchema.shape),
  userBaseSchema.extend({ role: z.literal("ADMIN") }).extend(facultyFieldsSchema.shape),
]);

export type UserFormInput = z.infer<typeof userFormSchema>;
