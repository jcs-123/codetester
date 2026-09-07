import { buildWorkbook } from "@/lib/excel/cells";
import { ATTEMPT_STATUS_LABEL } from "@/lib/tests/attempt-status";
import type { ExportData } from "@/lib/tests/results-queries";
import { formatDateTimeSeconds, formatDurationMs } from "@/lib/time";

const col = (header: string, width?: number) => ({ header, width });

/** Two-sheet results workbook (SRS §4.4). */
export async function buildResultsWorkbook(data: ExportData): Promise<Buffer> {
  const { test, summaryRows, summary, responses } = data;

  const summarySheetRows: (string | number | null)[][] = summaryRows.map((r) => {
    const a = r.attempt;
    const submitted = Boolean(a?.submittedAt);
    return [
      r.loginId,
      r.name,
      r.batch ?? "",
      ATTEMPT_STATUS_LABEL[r.status],
      submitted ? (a!.score ?? 0) : null,
      submitted ? (a!.totalQuestions ?? test.questionCount) : null,
      submitted ? Math.round(((a!.score ?? 0) / Math.max(1, a!.totalQuestions ?? test.questionCount)) * 10000) / 100 : null,
      a ? formatDateTimeSeconds(a.startedAt) : "",
      submitted ? formatDateTimeSeconds(a!.submittedAt) : "",
      submitted ? formatDurationMs(a!.submittedAt!.getTime() - a!.startedAt.getTime()) : "",
      a ? a.hintsUsed : null,
    ];
  });
  summarySheetRows.push(
    [],
    ["Assigned", summary.assigned],
    ["Started", summary.started],
    ["Submitted", summary.submitted],
    ["Average score", summary.average],
    ["Highest score", summary.highest],
    ["Lowest score", summary.lowest],
    ["Total marks", summary.total],
  );

  const responseRows: (string | number | null)[][] = [];
  for (const { row, questions } of responses) {
    for (const q of questions) {
      responseRows.push([
        row.loginId,
        row.name,
        q.number,
        q.text,
        q.chosenLabel ?? "",
        q.correctLabel ?? "",
        q.outcome === "correct" ? "Correct" : q.outcome === "incorrect" ? "Incorrect" : "Unanswered",
        q.hintUsed ? "Yes" : "No",
        q.answeredAt ? formatDateTimeSeconds(q.answeredAt) : "",
      ]);
    }
  }

  return buildWorkbook([
    {
      name: "Summary",
      columns: [
        col("Student ID", 14),
        col("Name", 26),
        col("Batch", 8),
        col("Status", 26),
        col("Score", 8),
        col("Total", 8),
        col("Percentage", 12),
        col("Started at", 20),
        col("Submitted at", 20),
        col("Time taken", 12),
        col("Hints used", 12),
      ],
      rows: summarySheetRows,
    },
    {
      name: "Responses",
      columns: [
        col("Student ID", 14),
        col("Name", 26),
        col("Question No", 12),
        col("Question", 60),
        col("Chosen", 8),
        col("Correct", 8),
        col("Result", 12),
        col("Hint used", 10),
        col("Answered at", 20),
      ],
      rows: responseRows,
    },
  ]);
}

export function resultsFileName(test: { subjectCode: string; name: string }): string {
  const slug = test.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const date = new Date().toISOString().slice(0, 10);
  return `${test.subjectCode}_${slug}_${date}.xlsx`;
}
