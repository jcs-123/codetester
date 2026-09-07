/** SRS §3.7 — one mark per correct answer, nothing else. */
export type ScorableAnswer = { selectedOptionId: string | null; correctOptionId: string | null };

export function computeScore(answers: readonly ScorableAnswer[]): number {
  let score = 0;
  for (const a of answers) if (a.selectedOptionId && a.selectedOptionId === a.correctOptionId) score++;
  return score;
}

export function percentage(score: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((score / total) * 10000) / 100;
}

export type AnswerOutcome = "correct" | "incorrect" | "unanswered";

export function answerOutcome(a: ScorableAnswer): AnswerOutcome {
  if (!a.selectedOptionId) return "unanswered";
  return a.selectedOptionId === a.correctOptionId ? "correct" : "incorrect";
}
