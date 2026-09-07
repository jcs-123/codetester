import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { importPreviews } from "@/lib/db/schema";
import { xlsxResponse } from "@/lib/excel/response";
import { buildErrorsWorkbook } from "@/lib/excel/templates";
import { getSessionUser } from "@/lib/permissions";

export async function GET(_req: Request, { params }: { params: Promise<{ previewId: string }> }) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
  const { previewId } = await params;
  const preview = await db.query.importPreviews.findFirst({ where: eq(importPreviews.id, previewId) });
  if (!preview || preview.uploadedById !== user.id) return new Response("Not found", { status: 404 });
  const buf = await buildErrorsWorkbook(preview.errors);
  return xlsxResponse(buf, `import-errors-${preview.fileName.replace(/\.xlsx$/i, "")}.xlsx`);
}
