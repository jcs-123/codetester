import { describe, expect, it } from "vitest";

import { buildWorkbook } from "@/lib/excel/cells";
import { parseQuestionsWorkbook } from "@/lib/excel/parse-questions";
import { QUESTION_COLUMNS } from "@/lib/excel/templates";

const file = (rows: (string | number | null)[][], headers: readonly string[] = QUESTION_COLUMNS) =>
  buildWorkbook([{ name: "Questions", columns: headers.map((header) => ({ header })), rows }]);

const good = (n: number, answer = "B"): (string | number)[] => [
  n,
  `Question ${n}?`,
  "Alpha",
  "Beta",
  "Gamma",
  "Delta",
  n % 2 ? "A hint" : "",
  answer,
  n % 3 ? "" : "Because.",
];

describe("parseQuestionsWorkbook", () => {
  it("parses valid questions, sorts by number, keeps optional fields only when present", async () => {
    const res = await parseQuestionsWorkbook(await file([good(2, "c"), good(1)]));
    expect(res.errors).toEqual([]);
    expect(res.total).toBe(2);
    expect(res.questions.map((q) => q.number)).toEqual([1, 2]);
    expect(res.questions[0]).toMatchObject({ row: 3, number: 1, answer: "B", hint: "A hint" });
    expect(res.questions[0]?.explanation).toBeUndefined();
    expect(res.questions[1]).toMatchObject({ number: 2, answer: "C" });
    expect(res.questions[1]?.hint).toBeUndefined();
    expect(res.questions[1]?.options.map((o) => o.label)).toEqual(["A", "B", "C", "D"]);
  });

  it("reports every problem with its row and column", async () => {
    const res = await parseQuestionsWorkbook(
      await file([
        good(1),
        [1, "Dup number", "a", "b", "c", "d", "", "A", ""], // row 3
        ["x", "Bad number", "a", "b", "c", "d", "", "A", ""], // row 4
        [4, "", "a", "b", "c", "d", "", "A", ""], // row 5: no question
        [5, "Missing option", "a", "", "c", "d", "", "A", ""], // row 6
        [6, "Bad answer", "a", "b", "c", "d", "", "E", ""], // row 7
      ]),
    );
    expect(res.questions).toHaveLength(1);
    expect(res.errors.map((e) => [e.row, e.column])).toEqual([
      [3, "Question No"],
      [4, "Question No"],
      [5, "Question"],
      [6, "Option B"],
      [7, "Answer"],
    ]);
  });

  it("rejects missing columns and too many questions", async () => {
    const missing = await parseQuestionsWorkbook(await file([[1, "q", "a", "b"]], ["Question No", "Question", "Option A", "Option B"]));
    expect(missing.errors[0]?.message).toMatch(/Missing column/);

    const many = await parseQuestionsWorkbook(await file(Array.from({ length: 201 }, (_, i) => good(i + 1))));
    expect(many.questions).toEqual([]);
    expect(many.errors[0]?.message).toMatch(/Too many/);
  });

  it("enforces length limits", async () => {
    const res = await parseQuestionsWorkbook(await file([[1, "x".repeat(2001), "a", "b", "c", "d", "h".repeat(501), "A", ""]]));
    expect(res.errors.map((e) => e.column)).toEqual(["Question", "Hint"]);
  });
});
