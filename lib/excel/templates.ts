import type { ImportRowError } from "@/lib/db/schema";
import { buildWorkbook } from "@/lib/excel/cells";
import { FACULTY_COLUMNS, STUDENT_COLUMNS } from "@/lib/excel/parse-users";

export const QUESTION_COLUMNS = [
  "Question No",
  "Question",
  "Option A",
  "Option B",
  "Option C",
  "Option D",
  "Hint",
  "Answer",
  "Explanation",
] as const;

const col = (header: string, width?: number) => ({ header, width });

export async function buildFacultyTemplate(): Promise<Buffer> {
  return buildWorkbook([
    {
      name: "Faculty",
      columns: [col("Staff ID", 14), col("Name", 28), col("Email", 30), col("Department", 14), col("Designation", 24), col("Password", 16)],
      rows: [["JEC1023", "Dr. Anitha Menon", "anitha.m@jecc.ac.in", "CSE", "Associate Professor", "Jecc@2026x"]],
    },
    instructionsSheet([
      "Fill one row per faculty member. Keep the header row exactly as it is.",
      `Columns: ${FACULTY_COLUMNS.join(", ")}.`,
      "Staff ID: letters, digits, dots and hyphens only (max 30). It is the login ID.",
      "Email: the college Google account. Required — it is used for Google sign-in and password reset.",
      "Password: required for NEW staff (min 8 characters, at least one letter and one digit). Leave empty for existing staff to keep their password.",
      "Existing Staff IDs are updated; new ones are created. Delete the example row before importing.",
    ]),
  ]);
}

export async function buildStudentTemplate(): Promise<Buffer> {
  return buildWorkbook([
    {
      name: "Students",
      columns: [
        col("Student ID", 14),
        col("Name", 28),
        col("Email", 30),
        col("Department", 14),
        col("Semester", 10),
        col("Batch", 10),
        col("Admission Year", 16),
        col("Password", 16),
      ],
      rows: [["JEC22CS045", "Arjun R", "jec22cs045@jecc.ac.in", "CSE", 5, "A", 2022, "Jecc@2026x"]],
    },
    instructionsSheet([
      "Fill one row per student. Keep the header row exactly as it is.",
      `Columns: ${STUDENT_COLUMNS.join(", ")}.`,
      "Student ID: letters, digits, dots and hyphens only (max 30). It is the login ID.",
      "Semester: 1 to 8. Batch: the section/division (A, B, CS1 …). Admission Year: four digits.",
      "Password: required for NEW students (min 8 characters, at least one letter and one digit). Leave empty for existing students.",
      "Existing Student IDs are updated (use this to move a class to the next semester); new ones are created. Delete the example row before importing.",
    ]),
  ]);
}

export async function buildQuestionTemplate(): Promise<Buffer> {
  return buildWorkbook([
    {
      name: "Questions",
      columns: [
        col("Question No", 12),
        col("Question", 60),
        col("Option A", 24),
        col("Option B", 24),
        col("Option C", 24),
        col("Option D", 24),
        col("Hint", 30),
        col("Answer", 10),
        col("Explanation", 50),
      ],
      rows: [
        [1, "Which data structure uses LIFO order?", "Queue", "Stack", "Linked list", "Tree", "Think of a pile of plates.", "B", "A stack removes the most recently added item first."],
        [2, "Time complexity of binary search on a sorted array of n items?", "O(n)", "O(n log n)", "O(log n)", "O(1)", "", "C", "Each step halves the search space."],
      ],
    },
    instructionsSheet([
      "One row per question. Keep the header row exactly as it is. Delete the example rows before uploading.",
      `Columns: ${QUESTION_COLUMNS.join(", ")}. Hint and Explanation are optional.`,
      "Answer must be A, B, C or D.",
      "IMPORTANT: options are shuffled for every student. Do not write options that refer to other options, such as 'All of the above', 'Both A and C' or 'None of the above'.",
      "Plain text only — images and formulae are not supported. Maximum 200 questions per test.",
    ]),
  ]);
}

export async function buildErrorsWorkbook(errors: ImportRowError[]): Promise<Buffer> {
  return buildWorkbook([
    {
      name: "Errors",
      columns: [col("Row", 8), col("Column", 18), col("Message", 70)],
      rows: errors.map((e) => [e.row, e.column, e.message]),
    },
  ]);
}

function instructionsSheet(lines: string[]) {
  return {
    name: "Instructions",
    columns: [col("Instructions", 110)],
    rows: lines.map((l) => [l]),
    freezeHeader: false,
  };
}
