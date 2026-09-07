/**
 * Generates sample Excel files for trying the import and test-creation flows.
 *
 *   pnpm tsx scripts/dev-samples.ts        -> writes ./samples/*.xlsx
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { faculty, facultyWorkbook, questions, questionsWorkbook, students, studentsWithErrorsWorkbook, studentsWorkbook } from "./sample-data";

const out = join(process.cwd(), "samples");
mkdirSync(out, { recursive: true });

async function main() {
  writeFileSync(join(out, "students-sample.xlsx"), await studentsWorkbook());
  writeFileSync(join(out, "faculty-sample.xlsx"), await facultyWorkbook());
  writeFileSync(join(out, "students-with-errors.xlsx"), await studentsWithErrorsWorkbook());
  writeFileSync(join(out, "questions-sample.xlsx"), await questionsWorkbook());
  console.log(`Wrote 4 files to ${out} (${students.length} students, ${faculty.length} faculty, ${questions.length} questions)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
