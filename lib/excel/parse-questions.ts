import type { ImportRowError } from "@/lib/db/schema";
import { headerKey, readFirstSheet } from "@/lib/excel/cells";

export const OPTION_LABELS = ["A", "B", "C", "D"] as const;
export type OptionLabel = (typeof OPTION_LABELS)[number];

export type ParsedQuestion = {
  row: number;
  number: number;
  text: string;
  options: { label: OptionLabel; text: string }[];
  hint?: string;
  answer: OptionLabel;
  explanation?: string;
};

export type ParseQuestionsResult = { questions: ParsedQuestion[]; errors: ImportRowError[]; total: number };

/** Limits from SRS FR-FAC-05 / §4.3. */
export const MAX_QUESTIONS = 200;
export const MAX_QUESTION_CHARS = 2000;
export const MAX_OPTION_CHARS = 500;
export const MAX_HINT_CHARS = 500;
export const MAX_EXPLANATION_CHARS = 2000;

const REQUIRED = ["questionno", "question", "optiona", "optionb", "optionc", "optiond", "answer"] as const;
type ColumnKey = (typeof REQUIRED)[number] | "hint" | "explanation";
const LABELS: Record<ColumnKey, string> = {
  questionno: "Question No",
  question: "Question",
  optiona: "Option A",
  optionb: "Option B",
  optionc: "Option C",
  optiond: "Option D",
  hint: "Hint",
  answer: "Answer",
  explanation: "Explanation",
};

export async function parseQuestionsWorkbook(data: ArrayBuffer | Buffer): Promise<ParseQuestionsResult> {
  const errors: ImportRowError[] = [];
  const { header, rows } = await readFirstSheet(data);

  const col = new Map<string, number>();
  header.forEach((h, i) => {
    const k = headerKey(h);
    if (!col.has(k)) col.set(k, i);
  });
  const missing = REQUIRED.filter((k) => !col.has(k)).map((k) => LABELS[k]);
  if (missing.length) {
    errors.push({ row: 1, column: "Header", message: `Missing column(s): ${missing.join(", ")}` });
    return { questions: [], errors, total: rows.length };
  }
  if (rows.length === 0) {
    errors.push({ row: 2, column: "—", message: "The file has no questions." });
    return { questions: [], errors, total: 0 };
  }
  if (rows.length > MAX_QUESTIONS) {
    errors.push({ row: 2, column: "—", message: `Too many questions (${rows.length}). Maximum is ${MAX_QUESTIONS}.` });
    return { questions: [], errors, total: rows.length };
  }

  const get = (cells: string[], k: ColumnKey) => {
    const i = col.get(k);
    return i === undefined ? "" : (cells[i] ?? "").trim();
  };

  const questions: ParsedQuestion[] = [];
  const seen = new Map<number, number>();

  for (const r of rows) {
    const rowErrors: ImportRowError[] = [];
    const err = (k: ColumnKey, message: string) => rowErrors.push({ row: r.n, column: LABELS[k], message });

    const numRaw = get(r.cells, "questionno");
    const number = Number(numRaw);
    if (!numRaw || !Number.isInteger(number) || number <= 0) err("questionno", "Must be a positive whole number");
    else if (seen.has(number)) err("questionno", `Duplicate question number — also on row ${seen.get(number)}`);

    const text = get(r.cells, "question");
    if (!text) err("question", "Question text is required");
    else if (text.length > MAX_QUESTION_CHARS) err("question", `Longer than ${MAX_QUESTION_CHARS} characters`);

    const options = (["optiona", "optionb", "optionc", "optiond"] as const).map((k, i) => {
      const v = get(r.cells, k);
      if (!v) err(k, "Option text is required");
      else if (v.length > MAX_OPTION_CHARS) err(k, `Longer than ${MAX_OPTION_CHARS} characters`);
      return { label: OPTION_LABELS[i]!, text: v };
    });

    const answerRaw = get(r.cells, "answer").toUpperCase();
    const answer = OPTION_LABELS.find((l) => l === answerRaw);
    if (!answer) err("answer", "Must be A, B, C or D");

    const hint = get(r.cells, "hint");
    if (hint.length > MAX_HINT_CHARS) err("hint", `Longer than ${MAX_HINT_CHARS} characters`);
    const explanation = get(r.cells, "explanation");
    if (explanation.length > MAX_EXPLANATION_CHARS) err("explanation", `Longer than ${MAX_EXPLANATION_CHARS} characters`);

    if (rowErrors.length) {
      errors.push(...rowErrors);
      continue;
    }
    seen.set(number, r.n);
    questions.push({
      row: r.n,
      number,
      text,
      options,
      answer: answer!,
      ...(hint ? { hint } : {}),
      ...(explanation ? { explanation } : {}),
    });
  }

  questions.sort((a, b) => a.number - b.number);
  return { questions, errors, total: rows.length };
}
