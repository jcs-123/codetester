import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Production: PostgreSQL on Supabase via postgres-js.
 * Local development without a server: `DATABASE_URL=pglite://./.pglite`
 * runs an embedded Postgres (PGlite) in a local folder. Same schema, same
 * migrations, same query API.
 */
export const isPglite = Boolean(env.DATABASE_URL?.startsWith("pglite:"));

// Reused across hot reloads in development (and across PGlite instances, which
// must not open the same data directory twice).
const globalForDb = globalThis as unknown as { db?: Db };

const fallbackDbUrl = "postgresql://postgres.scksdrisyrmjvktjydjg:PToDbkc9T6RzmLIx@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require";

function createDb(): Db {
  if (isPglite) {
    // Lazy require keeps the WASM bundle out of the production build path.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle: drizzlePglite } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
    const dataDir = env.DATABASE_URL.replace(/^pglite:\/\//, "").replace(/^pglite:/, "") || "./.pglite";
    const client = new PGlite(dataDir);
    return drizzlePglite(client, { schema }) as unknown as Db;
  }
  const client = postgres(env.DATABASE_URL || fallbackDbUrl, {
    // Supabase's transaction pooler does not support prepared statements.
    prepare: false,
    max: env.NODE_ENV === "production" ? 10 : 5,
  });
  return drizzlePg(client, { schema });
}

function getDb(): Db {
  if (!globalForDb.db) globalForDb.db = createDb();
  return globalForDb.db;
}

/**
 * The connection is opened on first use, not on import: `next build` imports
 * these modules while prerendering static pages and must not touch the database.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver === undefined ? real : real);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});

export { schema };
