import { randomInt } from "node:crypto";

/** Fisher–Yates with a cryptographic RNG (SRS §7.4). `rand(n)` returns an integer in [0, n). */
export function shuffle<T>(items: readonly T[], rand: (maxExclusive: number) => number = randomInt): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Builds the per-attempt orders stored on `test_attempts`:
 * the question order, and for each question the order of its option ids.
 */
export function buildAttemptOrders(
  questions: { id: string; optionIds: string[] }[],
  rand?: (maxExclusive: number) => number,
): { questionOrder: string[]; optionOrder: Record<string, string[]> } {
  const questionOrder = shuffle(questions.map((q) => q.id), rand);
  const optionOrder: Record<string, string[]> = {};
  for (const q of questions) optionOrder[q.id] = shuffle(q.optionIds, rand);
  return { questionOrder, optionOrder };
}
