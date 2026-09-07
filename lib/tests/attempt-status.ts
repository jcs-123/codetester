/** Pure helpers shared by server and client code — no database imports here. */

export type AttemptStatus = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "AUTO_TIMEOUT" | "AUTO_CLOSED";

export const ATTEMPT_STATUS_LABEL: Record<AttemptStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  AUTO_TIMEOUT: "Auto-submitted (time up)",
  AUTO_CLOSED: "Auto-submitted (closed)",
};

type AttemptLike = { submittedAt: Date | null; submitType: "MANUAL" | "TIMEOUT" | "CLOSED" | null } | null;

export function attemptStatus(a: AttemptLike): AttemptStatus {
  if (!a) return "NOT_STARTED";
  if (!a.submittedAt) return "IN_PROGRESS";
  if (a.submitType === "TIMEOUT") return "AUTO_TIMEOUT";
  if (a.submitType === "CLOSED") return "AUTO_CLOSED";
  return "SUBMITTED";
}

export type ResultSummary = {
  assigned: number;
  started: number;
  submitted: number;
  average: number | null;
  highest: number | null;
  lowest: number | null;
  total: number;
};

/** FR-RES-04 summary figures over the assigned students. */
export function summarize(
  rows: { attempt: { submittedAt: Date | null; score: number | null } | null }[],
  totalQuestions: number,
): ResultSummary {
  const submitted = rows.filter((r) => r.attempt?.submittedAt);
  const scores = submitted.map((r) => r.attempt!.score ?? 0);
  return {
    assigned: rows.length,
    started: rows.filter((r) => r.attempt).length,
    submitted: submitted.length,
    average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null,
    highest: scores.length ? Math.max(...scores) : null,
    lowest: scores.length ? Math.min(...scores) : null,
    total: totalQuestions,
  };
}
