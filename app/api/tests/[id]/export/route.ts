import { buildResultsWorkbook, resultsFileName } from "@/lib/excel/export-results";
import { xlsxResponse } from "@/lib/excel/response";
import { getSessionUser } from "@/lib/permissions";
import { finalizeExpiredAttempts } from "@/lib/tests/attempts";
import { getTestForUser } from "@/lib/tests/queries";
import { getExportData } from "@/lib/tests/results-queries";

/** FR-RES-06 / FR-ADM-16: results workbook for the test's faculty owner or an admin. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || user.role === "STUDENT") return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const row = await getTestForUser(id, user);
  if (!row) return new Response("Not found", { status: 404 });

  await finalizeExpiredAttempts();
  const data = await getExportData(row.test);
  return xlsxResponse(await buildResultsWorkbook(data), resultsFileName(row.test));
}

export const dynamic = "force-dynamic";
