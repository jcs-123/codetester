import { db, type Tx } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

export type AuditEntry = {
  actorId: string | null;
  action: string; // "test.create", "user.import", "attempt.reset", ...
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

/** NFR-08: every significant change is recorded with actor and before/after. */
export async function logAudit(entry: AuditEntry, tx?: Tx): Promise<void> {
  await (tx ?? db).insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}
