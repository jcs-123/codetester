/**
 * Typed result returned by every Server Action (STACK.md §10, SRS §7.11).
 * Expected failures are values, not exceptions.
 */
export type ActionErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "TEST_NOT_LIVE"
  | "TEST_STARTED"
  | "ATTEMPT_SUBMITTED"
  | "DEADLINE_PASSED"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "INTERNAL";

export type ActionError = {
  code: ActionErrorCode;
  message: string;
  fields?: Record<string, string>;
};

export type ActionFailure = { ok: false; error: ActionError };
export type ActionResult<T = void> = { ok: true; data: T } | ActionFailure;

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(code: ActionErrorCode, message: string, fields?: Record<string, string>): ActionFailure {
  return { ok: false, error: { code, message, fields } };
}

/** Flattens a Zod error into { fieldName: firstMessage }. */
export function zodFields(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.map(String).join(".") || "_";
    if (!(key in out)) out[key] = i.message;
  }
  return out;
}
