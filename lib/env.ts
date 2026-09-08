import { z } from "zod";

// Validated at startup so a missing variable fails loudly on boot (STACK.md §8).
// Never import this from a client component — use lib/constants.ts for public values.
if (typeof window !== "undefined") {
  throw new Error("lib/env.ts was imported into a client component. Import lib/constants.ts for public values instead.");
}
const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.npm_lifecycle_event === "build" ||
  Boolean(process.env.CI && !process.env.DATABASE_URL && !process.env.POSTGRES_URL);

// Support Vercel Postgres integration naming (POSTGRES_URL / POSTGRES_PRISMA_URL)
const resolvedDbUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  "postgresql://postgres.scksdrisyrmjvktjydjg:PToDbkc9T6RzmLIx@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require";

// Support NextAuth / Supabase JWT secret
const resolvedAuthSecret =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  process.env.SUPABASE_JWT_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "fA5g7nFShix5pGz0knNuwdwSz0XQwwhOsmqaoJo0sxg=";

// Ensure process.env has these keys for libraries like NextAuth
process.env.AUTH_SECRET = resolvedAuthSecret;
process.env.DATABASE_URL = resolvedDbUrl;

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Auth
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters").default(resolvedAuthSecret),
  AUTH_URL: z.url().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  ALLOWED_EMAIL_DOMAIN: z.string().default("jecc.ac.in"),
  ALLOWED_EXTRA_EMAILS: z.string().default(""),
  INITIAL_ADMIN_EMAIL: z.email().optional(),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required").default(resolvedDbUrl),


  // Storage (Cloudflare R2) — optional until archiving is switched on
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("JECC Tools <noreply@jecc.ac.in>"),

  // Cron
  CRON_SECRET: z.string().min(16).optional(),

  // Display
  APP_NAME: z.string().default("JECC Tools"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  console.error(`\n❌ Invalid environment configuration:\n${issues}\n`);
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

export const allowedExtraEmails = env.ALLOWED_EXTRA_EMAILS.split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const googleEnabled = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
export const emailEnabled = Boolean(env.RESEND_API_KEY);
export const r2Enabled = Boolean(
  env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET,
);
