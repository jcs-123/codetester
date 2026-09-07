import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

const BCRYPT_COST = 12;
/**
 * Bulk imports hash hundreds of passwords inside one request; cost 10 (~65 ms
 * each) keeps a 500-row import within the request time limit while remaining
 * a standard, safe bcrypt setting.
 */
export const BCRYPT_COST_BULK = 10;

export async function hashPassword(plain: string, cost: number = BCRYPT_COST): Promise<string> {
  return bcrypt.hash(plain, cost);
}

export async function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

/** FR-AUTH-07: min 8 chars, at least one letter and one digit. */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/\d/, "Password must contain at least one digit");

/** Password must not equal the user's login ID (case-insensitive). */
export function passwordDiffersFromId(password: string, loginId: string): boolean {
  return password.trim().toLowerCase() !== loginId.trim().toLowerCase();
}

/** Generates a temporary password that satisfies passwordSchema. */
export function generateTemporaryPassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;
  const pick = (set: string) => set[randomBytes(1)[0] % set.length];
  let out = pick(letters) + pick(digits);
  for (let i = 0; i < 8; i++) out += pick(all);
  return out;
}

/** Raw reset token for the email link, plus the hash we store. */
export function createResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashResetToken(raw) };
}

export function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
