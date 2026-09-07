/** FR-ADM-14: trim, collapse internal whitespace. Display form. */
export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Comparison key — case-insensitive. */
export function normalizeKey(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

export function normalizeLoginId(value: unknown): string {
  return normalizeText(value).toUpperCase();
}

export function normalizeEmail(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

/** "  cse " -> "CSE", "Computer science" -> "Computer science" (first spelling wins elsewhere). */
export function normalizeDepartment(value: unknown): string {
  const t = normalizeText(value);
  // Short codes are conventionally upper-case.
  return t.length <= 5 ? t.toUpperCase() : t;
}

export function normalizeBatch(value: unknown): string {
  return normalizeText(value).toUpperCase();
}
