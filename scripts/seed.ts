/**
 * Seeds the first ADMIN account from INITIAL_ADMIN_EMAIL (STACK.md §3 "Provisioning").
 *
 *   pnpm db:seed
 *
 * Optional environment overrides:
 *   INITIAL_ADMIN_LOGIN_ID   (default: ADMIN)
 *   INITIAL_ADMIN_NAME       (default: Administrator)
 *   INITIAL_ADMIN_PASSWORD   (default: a generated temporary password, printed once)
 *
 * Safe to re-run: does nothing if a user with that email already exists.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"] });

async function main() {
  // Imported after dotenv so lib/env sees the variables.
  const { db } = await import("../lib/db");
  const { users } = await import("../lib/db/schema");
  const { generateTemporaryPassword, hashPassword } = await import("../lib/password");
  const { sql } = await import("drizzle-orm");

  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("INITIAL_ADMIN_EMAIL is not set");

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  if (existing.length) {
    console.log(`Admin already exists for ${email} — nothing to do.`);
    return;
  }

  const loginId = (process.env.INITIAL_ADMIN_LOGIN_ID ?? "ADMIN").trim().toUpperCase();
  const name = process.env.INITIAL_ADMIN_NAME?.trim() || "Administrator";
  const password = process.env.INITIAL_ADMIN_PASSWORD || generateTemporaryPassword();

  await db.insert(users).values({
    loginId,
    role: "ADMIN",
    name,
    email,
    department: "ADMIN",
    designation: "Administrator",
    passwordHash: await hashPassword(password),
    mustChangePassword: false,
    isActive: true,
  });

  console.log("Admin account created.");
  console.log(`  Login ID : ${loginId}`);
  console.log(`  Email    : ${email}`);
  console.log(`  Password : ${password}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
