import { describe, expect, it } from "vitest";

import {
  createResetToken,
  generateTemporaryPassword,
  hashPassword,
  hashResetToken,
  passwordDiffersFromId,
  passwordSchema,
  verifyPassword,
} from "@/lib/password";

describe("passwordSchema (FR-AUTH-07)", () => {
  it.each(["Jecc@2026x", "abcdefg1", "12345678a"])("accepts %s", (p) => {
    expect(passwordSchema.safeParse(p).success).toBe(true);
  });
  it.each(["short1", "abcdefgh", "12345678", ""])("rejects %s", (p) => {
    expect(passwordSchema.safeParse(p).success).toBe(false);
  });
});

describe("passwordDiffersFromId", () => {
  it("is case-insensitive", () => {
    expect(passwordDiffersFromId("jec22cs045", "JEC22CS045")).toBe(false);
    expect(passwordDiffersFromId("Jecc@2026x", "JEC22CS045")).toBe(true);
  });
});

describe("generateTemporaryPassword", () => {
  it("always satisfies the password rules", () => {
    for (let i = 0; i < 50; i++) expect(passwordSchema.safeParse(generateTemporaryPassword()).success).toBe(true);
  });
});

describe("hash / verify", () => {
  it("round-trips and rejects wrong passwords", async () => {
    const hash = await hashPassword("Jecc@2026x", 4);
    expect(await verifyPassword("Jecc@2026x", hash)).toBe(true);
    expect(await verifyPassword("Jecc@2026y", hash)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
  });
});

describe("reset tokens", () => {
  it("stores only a hash of the raw token", () => {
    const { raw, hash } = createResetToken();
    expect(raw).not.toBe(hash);
    expect(hashResetToken(raw)).toBe(hash);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
