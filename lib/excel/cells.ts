import ExcelJS from "exceljs";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Coerces any ExcelJS cell value (rich text, hyperlink, formula, date…) to a trimmed string. */
export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as unknown as Record<string, unknown>;
    if (Array.isArray(v.richText)) {
      return (v.richText as { text: string }[]).map((r) => r.text).join("").trim();
    }
    if (typeof v.text === "string") return v.text.trim(); // hyperlink
    if (typeof v.text === "object" && v.text && Array.isArray((v.text as { richText?: unknown }).richText)) {
      return ((v.text as { richText: { text: string }[] }).richText).map((r) => r.text).join("").trim();
    }
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue); // formula
    if (v.error) return "";
    return "";
  }
  return String(value).trim();
}

/** "Staff ID" -> "staffid", " Admission Year " -> "admissionyear". */
export function headerKey(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type SheetRow = { n: number; cells: string[] };

/** Reads the first worksheet: header row (row 1) and non-empty data rows. */
export async function readFirstSheet(
  data: ArrayBuffer | Buffer,
): Promise<{ header: string[]; rows: SheetRow[]; sheetName: string }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as never);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("The workbook has no worksheets.");

  const header: string[] = [];
  const headerRow = ws.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    header[col - 1] = cellText(cell.value);
  });

  const rows: SheetRow[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const cells: string[] = [];
    for (let c = 1; c <= header.length; c++) cells[c - 1] = cellText(row.getCell(c).value);
    if (cells.every((v) => v === "")) return;
    rows.push({ n, cells });
  });

  return { header, rows, sheetName: ws.name };
}

/** Builds a workbook buffer from a list of sheets. */
export async function buildWorkbook(
  sheets: {
    name: string;
    columns: { header: string; width?: number }[];
    rows: (string | number | null | undefined)[][];
    freezeHeader?: boolean;
  }[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "JECC Tools";
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name, s.freezeHeader === false ? {} : { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = s.columns.map((c) => ({ header: c.header, width: c.width ?? Math.max(12, c.header.length + 4) }));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E2F3" } };
    for (const r of s.rows) ws.addRow(r.map((v) => (v === undefined ? null : v)));
    if (s.rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.columns.length } };
  }
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
