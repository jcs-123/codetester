import { describe, expect, it } from "vitest";

import { answersVisible, computeDeadline, effectiveEndsAt, testStatus } from "@/lib/tests/status";
import { buildAttemptOrders, shuffle } from "@/lib/tests/shuffle";
import { answerOutcome, computeScore, percentage } from "@/lib/tests/scoring";

const t = (start: string, end: string, closed: string | null = null) => ({
  startsAt: new Date(start),
  endsAt: new Date(end),
  closedAt: closed ? new Date(closed) : null,
});

describe("testStatus (SRS §3.6)", () => {
  const w = t("2026-09-10T09:00:00Z", "2026-09-10T11:00:00Z");
  it("is SCHEDULED before start, LIVE inside, CLOSED after", () => {
    expect(testStatus(w, new Date("2026-09-10T08:59:59Z"))).toBe("SCHEDULED");
    expect(testStatus(w, new Date("2026-09-10T09:00:00Z"))).toBe("LIVE");
    expect(testStatus(w, new Date("2026-09-10T10:59:59Z"))).toBe("LIVE");
    expect(testStatus(w, new Date("2026-09-10T11:00:00Z"))).toBe("CLOSED");
  });
  it("is CLOSED once closed early", () => {
    const closed = t("2026-09-10T09:00:00Z", "2026-09-10T11:00:00Z", "2026-09-10T10:00:00Z");
    expect(testStatus(closed, new Date("2026-09-10T10:00:01Z"))).toBe("CLOSED");
    expect(effectiveEndsAt(closed)).toEqual(new Date("2026-09-10T10:00:00Z"));
    expect(effectiveEndsAt(w)).toEqual(w.endsAt);
  });
});

describe("computeDeadline (FR-STU-12)", () => {
  const end = new Date("2026-09-10T11:00:00Z");
  it("uses the duration when there is time", () => {
    expect(computeDeadline(new Date("2026-09-10T09:00:00Z"), 30, end)).toEqual(new Date("2026-09-10T09:30:00Z"));
  });
  it("is capped by the test end", () => {
    expect(computeDeadline(new Date("2026-09-10T10:50:00Z"), 30, end)).toEqual(end);
  });
});

describe("answersVisible (FR-FAC-14)", () => {
  const w = { ...t("2026-09-10T09:00:00Z", "2026-09-10T11:00:00Z"), showAnswers: "AFTER_END" as const };
  it("hides answers until the window closes by default", () => {
    expect(answersVisible(w, true, new Date("2026-09-10T10:00:00Z"))).toBe(false);
    expect(answersVisible(w, true, new Date("2026-09-10T11:00:00Z"))).toBe(true);
    expect(answersVisible(w, false, new Date("2026-09-11T00:00:00Z"))).toBe(false);
  });
  it("shows immediately when the test says so", () => {
    expect(answersVisible({ ...w, showAnswers: "IMMEDIATELY" }, true, new Date("2026-09-10T10:00:00Z"))).toBe(true);
  });
});

describe("shuffle", () => {
  it("is a permutation and is deterministic for a given rng", () => {
    const seq = [3, 0, 1, 0];
    let i = 0;
    const rng = () => seq[i++ % seq.length]!;
    const out = shuffle(["a", "b", "c", "d", "e"], rng);
    expect([...out].sort()).toEqual(["a", "b", "c", "d", "e"]);
    expect(out).toHaveLength(5);
  });
  it("builds orders for every question and option", () => {
    const orders = buildAttemptOrders([
      { id: "q1", optionIds: ["o1", "o2", "o3", "o4"] },
      { id: "q2", optionIds: ["o5", "o6", "o7", "o8"] },
    ]);
    expect([...orders.questionOrder].sort()).toEqual(["q1", "q2"]);
    expect([...orders.optionOrder.q1!].sort()).toEqual(["o1", "o2", "o3", "o4"]);
    expect([...orders.optionOrder.q2!].sort()).toEqual(["o5", "o6", "o7", "o8"]);
  });
});

describe("scoring (SRS §3.7)", () => {
  it("counts only exact matches; unanswered is 0", () => {
    const answers = [
      { selectedOptionId: "a", correctOptionId: "a" },
      { selectedOptionId: "b", correctOptionId: "a" },
      { selectedOptionId: null, correctOptionId: "a" },
    ];
    expect(computeScore(answers)).toBe(1);
    expect(answers.map(answerOutcome)).toEqual(["correct", "incorrect", "unanswered"]);
    expect(percentage(1, 3)).toBe(33.33);
    expect(percentage(0, 0)).toBe(0);
  });
});
