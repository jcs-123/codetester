import type { ShowAnswers } from "@/lib/db/schema";

export type TestStatus = "SCHEDULED" | "LIVE" | "CLOSED";

export type TestWindow = { startsAt: Date; endsAt: Date; closedAt: Date | null };

/** SRS §3.6 — status is derived from time and the "closed" flag. */
export function testStatus(t: TestWindow, now: Date = new Date()): TestStatus {
  if (now < t.startsAt) return "SCHEDULED";
  if (t.closedAt && t.closedAt <= now) return "CLOSED";
  if (now >= t.endsAt) return "CLOSED";
  return "LIVE";
}

/** The moment students can no longer work: early close wins over the scheduled end. */
export function effectiveEndsAt(t: TestWindow): Date {
  return t.closedAt && t.closedAt < t.endsAt ? t.closedAt : t.endsAt;
}

/** FR-STU-12: deadline = min(start + duration, test end). */
export function computeDeadline(startedAt: Date, durationMinutes: number, endsAt: Date): Date {
  const byDuration = new Date(startedAt.getTime() + durationMinutes * 60_000);
  return byDuration < endsAt ? byDuration : endsAt;
}

/** FR-FAC-14 / FR-STU-14: may this student see correct answers and explanations? */
export function answersVisible(
  t: TestWindow & { showAnswers: ShowAnswers },
  attemptSubmitted: boolean,
  now: Date = new Date(),
): boolean {
  if (!attemptSubmitted) return false;
  if (t.showAnswers === "IMMEDIATELY") return true;
  return testStatus(t, now) === "CLOSED";
}

export const STATUS_LABEL: Record<TestStatus, string> = {
  SCHEDULED: "Scheduled",
  LIVE: "Live",
  CLOSED: "Closed",
};
