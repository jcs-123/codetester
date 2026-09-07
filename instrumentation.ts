/**
 * Runs once when the Next.js server starts.
 *
 * With the embedded development database (DATABASE_URL=pglite:…) migrations
 * are applied here, because only one process may open a PGlite data directory
 * at a time — running `drizzle-kit migrate` while `next dev` is up would not
 * be seen by the server. For PostgreSQL (Supabase) migrations are applied by
 * `pnpm db:migrate` during deployment instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL?.startsWith("pglite:")) return;

  const { db } = await import("@/lib/db");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(db as never, { migrationsFolder: "./drizzle" });
  console.log("[db] embedded PGlite database is up to date");
}
