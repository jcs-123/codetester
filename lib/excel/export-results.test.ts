import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { buildResultsWorkbook, resultsFileName } from "@/lib/excel/export-results";
import { summarize } from "@/lib/tests/attempt-status";
import type { ExportData } from "@/lib/tests/results-queries";

const started = new Date("2026-09-10T09:00:00Z");
const submitted = new Date("2026-09-10T09:15:30Z");

function fixture(): ExportData {
  const test = {
    id: "t1",
    createdById: "f1",
    name: "Series Test 1",
    subjectCode: "CST201",
    subjectName: "Data Structures",
    department: "CSE",
    semester: 5,
    batch: "A",
    startsAt: started,
    endsAt: new Date("2026-09-10T11:00:00Z"),
    durationMinutes: 30,
    instructions: null,
    showAnswers: "AFTER_END" as const,
    questionCount: 2,
    closedAt: null,
    closedById: null,
    questionFileKey: null,
    deletedAt: null,
    createdAt: started,
    updatedAt: started,
  };
  const attempt = {
    id: "a1",
    testId: "t1",
    studentId: "s1",
    startedAt: started,
    deadlineAt: new Date("2026-09-10T09:30:00Z"),
    submittedAt: submitted,
    submitType: "MANUAL" as const,
    questionOrder: ["q2", "q1"],
    optionOrder: {},
    score: 1,
    totalQuestions: 2,
    hintsUsed: 1,
    supersededAt: null,
    resetById: null,
    resetReason: null,
    createdAt: started,
    updatedAt: started,
  };
  const rows: ExportData["summaryRows"] = [
    { studentId: "s1", loginId: "JEC22CS001", name: "Arjun R", batch: "A", attempt, status: "SUBMITTED" },
    { studentId: "s2", loginId: "JEC22CS002", name: "Beena T", batch: "A", attempt: null, status: "NOT_STARTED" },
  ];
  const options = (p: string) => [
    { id: `${p}a`, label: "A", text: "opt a" },
    { id: `${p}b`, label: "B", text: "opt b" },
  ];
  return {
    test,
    summaryRows: rows,
    summary: summarize(rows, 2),
    responses: [
      {
        row: rows[0]!,
        questions: [
          { id: "q1", number: 1, text: "Q one", options: options("q1"), chosenOptionId: "q1a", chosenLabel: "A", correctOptionId: "q1a", correctLabel: "A", outcome: "correct", hintUsed: true, answeredAt: submitted },
          { id: "q2", number: 2, text: "Q two", options: options("q2"), chosenOptionId: null, chosenLabel: null, correctOptionId: "q2b", correctLabel: "B", outcome: "unanswered", hintUsed: false, answeredAt: null },
        ],
      },
    ],
  };
}

describe("buildResultsWorkbook (SRS §4.4)", () => {
  it("writes a Summary sheet and a Responses sheet with original option letters", async () => {
    const buf = await buildResultsWorkbook(fixture());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as never);

    const summary = wb.getWorksheet("Summary")!;
    const responses = wb.getWorksheet("Responses")!;
    expect(summary).toBeDefined();
    expect(responses).toBeDefined();

    const header = (summary.getRow(1).values as unknown[]).slice(1);
    expect(header).toEqual(["Student ID", "Name", "Batch", "Status", "Score", "Total", "Percentage", "Started at", "Submitted at", "Time taken", "Hints used"]);

    const r2 = (summary.getRow(2).values as unknown[]).slice(1);
    expect(r2.slice(0, 7)).toEqual(["JEC22CS001", "Arjun R", "A", "Submitted", 1, 2, 50]);
    expect(r2[9]).toBe("15:30");
    const r3 = (summary.getRow(3).values as unknown[]).slice(1);
    expect(r3.slice(0, 4)).toEqual(["JEC22CS002", "Beena T", "A", "Not started"]);

    // stats block after a blank row
    const labels = [5, 6, 7, 8, 9, 10, 11].map((n) => summary.getRow(n).getCell(1).value);
    expect(labels).toEqual(["Assigned", "Started", "Submitted", "Average score", "Highest score", "Lowest score", "Total marks"]);
    expect(summary.getRow(8).getCell(2).value).toBe(1);

    const q1 = (responses.getRow(2).values as unknown[]).slice(1);
    expect(q1).toEqual(["JEC22CS001", "Arjun R", 1, "Q one", "A", "A", "Correct", "Yes", expect.any(String)]);
    const q2 = (responses.getRow(3).values as unknown[]).slice(1, 8);
    expect(q2).toEqual(["JEC22CS001", "Arjun R", 2, "Q two", "", "B", "Unanswered"]);
    expect(responses.rowCount).toBe(3);
  });

  it("builds a safe file name", () => {
    expect(resultsFileName({ subjectCode: "CST201", name: "Series Test 1 — Data Structures!" })).toMatch(
      /^CST201_Series-Test-1-Data-Structures_\d{4}-\d{2}-\d{2}\.xlsx$/,
    );
  });
});
