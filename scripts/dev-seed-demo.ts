/**
 * Loads the demo faculty and students straight into the database (same
 * validation as the import wizard, without the UI). Run after `pnpm db:seed`,
 * with the dev server STOPPED when using the embedded PGlite database.
 *
 *   pnpm dev:demo
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"] });

async function main() {
  const { db } = await import("../lib/db");
  const { users } = await import("../lib/db/schema");
  const { sql } = await import("drizzle-orm");
  const { parseUsersWorkbook } = await import("../lib/excel/parse-users");
  const { BCRYPT_COST_BULK, hashPassword } = await import("../lib/password");
  const { facultyWorkbook, studentsWorkbook } = await import("./sample-data");

  let created = 0;
  let skipped = 0;
  for (const [type, buffer] of [
    ["FACULTY", await facultyWorkbook()],
    ["STUDENT", await studentsWorkbook()],
  ] as const) {
    const parsed = await parseUsersWorkbook(buffer, type);
    if (parsed.errors.length) throw new Error(`Sample ${type} file has errors: ${JSON.stringify(parsed.errors)}`);
    for (const r of parsed.rows) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.loginId}) = ${r.loginId.toLowerCase()}`)
        .limit(1);
      if (existing) {
        skipped++;
        continue;
      }
      await db.insert(users).values({
        loginId: r.loginId,
        role: type,
        name: r.name,
        email: r.email,
        department: r.department,
        designation: r.designation ?? null,
        semester: r.semester ?? null,
        batch: r.batch ?? null,
        admissionYear: r.admissionYear ?? null,
        passwordHash: r.password ? await hashPassword(r.password, BCRYPT_COST_BULK) : null,
        mustChangePassword: false,
      });
      created++;
    }
  }
  console.log(`Demo users: ${created} created, ${skipped} already existed.`);
  console.log("Try: faculty JEC1001 / Faculty@1001 · student JEC22CS001 / Student@1001");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
