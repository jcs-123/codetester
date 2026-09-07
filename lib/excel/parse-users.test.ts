import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { buildWorkbook } from "@/lib/excel/cells";
import { FACULTY_COLUMNS, parseUsersWorkbook, STUDENT_COLUMNS } from "@/lib/excel/parse-users";

const cols = (headers: readonly string[]) => headers.map((h) => ({ header: h }));
const studentsFile = (rows: (string | number | null)[][]) =>
  buildWorkbook([{ name: "Students", columns: cols(STUDENT_COLUMNS), rows }]);
const facultyFile = (rows: (string | number | null)[][]) =>
  buildWorkbook([{ name: "Faculty", columns: cols(FACULTY_COLUMNS), rows }]);

describe("parseUsersWorkbook — students", () => {
  it("parses valid rows and normalises values", async () => {
    const buf = await studentsFile([[" jec22cs045 ", " Arjun   R ", "JEC22CS045@jecc.ac.in", " cse", 5, "a", 2022, "Jecc@2026x"]]);
    const res = await parseUsersWorkbook(buf, "STUDENT");
    expect(res.errors).toEqual([]);
    expect(res.total).toBe(1);
    expect(res.rows[0]).toMatchObject({
      row: 2,
      loginId: "JEC22CS045",
      name: "Arjun R",
      email: "jec22cs045@jecc.ac.in",
      department: "CSE",
      semester: 5,
      batch: "A",
      admissionYear: 2022,
      password: "Jecc@2026x",
    });
  });

  it("omits password when the cell is empty", async () => {
    const buf = await studentsFile([["JEC22CS045", "Arjun R", "a@jecc.ac.in", "CSE", 5, "A", 2022, ""]]);
    const res = await parseUsersWorkbook(buf, "STUDENT");
    expect(res.errors).toEqual([]);
    expect(res.rows[0]?.password).toBeUndefined();
  });

  it("reports errors with row numbers and column names", async () => {
    const buf = await studentsFile([
      ["JEC22CS045", "Arjun R", "a@jecc.ac.in", "CSE", 5, "A", 2022, "Jecc@2026x"],
      ["JEC22CS045", "Dup ID", "b@jecc.ac.in", "CSE", 5, "A", 2022, "Jecc@2026x"], // row 3 duplicate id
      ["JEC22CS047", "Bad Email", "not-an-email", "CSE", 5, "A", 2022, "Jecc@2026x"], // row 4
      ["JEC22CS048", "Bad Sem", "c@jecc.ac.in", "CSE", 9, "A", 2022, "Jecc@2026x"], // row 5
      ["JEC22CS049", "Weak Pw", "d@jecc.ac.in", "CSE", 5, "A", 2022, "short"], // row 6
      ["JEC22CS050", "Pw = id", "e@jecc.ac.in", "CSE", 5, "A", 2022, "jec22cs050"], // row 7
    ]);
    const res = await parseUsersWorkbook(buf, "STUDENT");
    expect(res.rows).toHaveLength(1);
    expect(res.errors.map((e) => [e.row, e.column])).toEqual([
      [3, "Student ID"],
      [4, "Email"],
      [5, "Semester"],
      [6, "Password"],
      [7, "Password"],
    ]);
  });

  it("rejects a file with a missing required column", async () => {
    const buf = await buildWorkbook([
      { name: "Students", columns: cols(["Student ID", "Name", "Email"]), rows: [["X1", "Name", "x@jecc.ac.in"]] },
    ]);
    const res = await parseUsersWorkbook(buf, "STUDENT");
    expect(res.rows).toEqual([]);
    expect(res.errors[0]?.message).toMatch(/Missing column/);
  });

  it("ignores empty rows and reads hyperlink email cells", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Students");
    ws.addRow([...STUDENT_COLUMNS]);
    ws.addRow(["JEC22CS045", "Arjun R", "", "CSE", 5, "A", 2022, "Jecc@2026x"]);
    ws.getCell("C2").value = { text: "arjun@jecc.ac.in", hyperlink: "mailto:arjun@jecc.ac.in" };
    ws.addRow([]);
    ws.addRow(["JEC22CS046", "Beena", "beena@jecc.ac.in", "CSE", 5, "A", 2022, "Jecc@2026y"]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const res = await parseUsersWorkbook(buf, "STUDENT");
    expect(res.errors).toEqual([]);
    expect(res.rows.map((r) => r.email)).toEqual(["arjun@jecc.ac.in", "beena@jecc.ac.in"]);
    expect(res.rows.map((r) => r.row)).toEqual([2, 4]);
  });
});

describe("parseUsersWorkbook — faculty", () => {
  it("parses faculty rows", async () => {
    const buf = await facultyFile([["jec1023", "Dr. Anitha Menon", "Anitha.M@jecc.ac.in", "CSE", "Associate Professor", ""]]);
    const res = await parseUsersWorkbook(buf, "FACULTY");
    expect(res.errors).toEqual([]);
    expect(res.rows[0]).toMatchObject({
      loginId: "JEC1023",
      email: "anitha.m@jecc.ac.in",
      designation: "Associate Professor",
    });
    expect(res.rows[0]?.semester).toBeUndefined();
  });

  it("matches headers case- and space-insensitively", async () => {
    const buf = await buildWorkbook([
      {
        name: "x",
        columns: cols(["staff id", "NAME", " Email ", "department", "Designation", "password"]),
        rows: [["JEC1", "A", "a@jecc.ac.in", "ECE", "Prof", "Jecc@2026x"]],
      },
    ]);
    const res = await parseUsersWorkbook(buf, "FACULTY");
    expect(res.errors).toEqual([]);
    expect(res.rows).toHaveLength(1);
  });
});
