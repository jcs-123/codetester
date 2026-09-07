import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { users, type User } from "@/lib/db/schema";

const notDeleted = isNull(users.deletedAt);

export async function findUserById(id: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: and(eq(users.id, id), notDeleted) });
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  return db.query.users.findFirst({
    where: and(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`, notDeleted),
  });
}

export async function findUserByLoginId(loginId: string): Promise<User | undefined> {
  return db.query.users.findFirst({
    where: and(sql`lower(${users.loginId}) = ${loginId.trim().toLowerCase()}`, notDeleted),
  });
}

/** Finds by login ID or email — used by "forgot password". */
export async function findUserByIdOrEmail(idOrEmail: string): Promise<User | undefined> {
  const v = idOrEmail.trim();
  if (!v) return undefined;
  return v.includes("@") ? findUserByEmail(v) : findUserByLoginId(v);
}

export async function touchLastLogin(id: string): Promise<void> {
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id));
}

/** Where students of one class live. */
export function classFilter(department: string, semester: number, batch: string) {
  return and(
    eq(users.role, "STUDENT"),
    eq(users.isActive, true),
    notDeleted,
    sql`lower(${users.department}) = ${department.toLowerCase()}`,
    eq(users.semester, semester),
    sql`lower(${users.batch}) = ${batch.toLowerCase()}`,
  );
}
