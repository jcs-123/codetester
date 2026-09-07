import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

loadEnv({ path: [".env.local", ".env"] });

const url = process.env.DATABASE_URL ?? "pglite://./.pglite";
const isPglite = url.startsWith("pglite:");

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  ...(isPglite
    ? { driver: "pglite", dbCredentials: { url: url.replace(/^pglite:\/\//, "").replace(/^pglite:/, "") || "./.pglite" } }
    : { dbCredentials: { url } }),
  strict: true,
  verbose: true,
});
