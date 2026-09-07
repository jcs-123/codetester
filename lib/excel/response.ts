export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Wraps a workbook buffer as a file download. */
export function xlsxResponse(buffer: Buffer, fileName: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${fileName.replace(/["\r\n]/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
