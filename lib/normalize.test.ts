import { describe, expect, it } from "vitest";

import { normalizeBatch, normalizeDepartment, normalizeEmail, normalizeKey, normalizeLoginId, normalizeText } from "@/lib/normalize";
import { safeNext } from "@/lib/safe-next";

describe("normalize (FR-ADM-14)", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeText("  Computer   Science  ")).toBe("Computer Science");
    expect(normalizeKey(" CSE ")).toBe("cse");
  });
  it("upper-cases short department codes but keeps long names", () => {
    expect(normalizeDepartment(" cse ")).toBe("CSE");
    expect(normalizeDepartment("Computer science")).toBe("Computer science");
  });
  it("normalises ids, batches and emails", () => {
    expect(normalizeLoginId(" jec22cs045 ")).toBe("JEC22CS045");
    expect(normalizeBatch("a")).toBe("A");
    expect(normalizeEmail(" Arjun@JECC.ac.in ")).toBe("arjun@jecc.ac.in");
  });
  it("handles null and numbers", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(2022)).toBe("2022");
  });
});

describe("safeNext", () => {
  it("only allows same-origin relative paths", () => {
    expect(safeNext("/tests/abc")).toBe("/tests/abc");
    expect(safeNext("//evil.com")).toBe("");
    expect(safeNext("https://evil.com")).toBe("");
    expect(safeNext("/api/auth/signout")).toBe("");
    expect(safeNext("/login")).toBe("");
    expect(safeNext(undefined)).toBe("");
    expect(safeNext(["/a", "/b"])).toBe("/a");
  });
});
