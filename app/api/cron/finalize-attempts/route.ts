import { timingSafeEqual } from "node:crypto";
import { lt } from "drizzle-orm";

import { db } from "@/lib/db";
import { importPreviews, questionFilePreviews } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { purgeOldLoginAttempts } from "@/lib/rate-limit";
import { finalizeExpiredAttempts } from "@/lib/tests/attempts";

/** Vercel Cron safety net (SRS §7.1): every 5 minutes. Protected by CRON_SECRET. */
export async function GET(req: Request) {
  const secret = env.CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET is not configured", { status: 503 });
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length || !timingSafeEqual(Buffer.from(header), Buffer.from(expected))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const finalized = await finalizeExpiredAttempts();
  await purgeOldLoginAttempts();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.delete(importPreviews).where(lt(importPreviews.expiresAt, dayAgo));
  await db.delete(questionFilePreviews).where(lt(questionFilePreviews.expiresAt, dayAgo));

  return Response.json({ ok: true, finalized, at: new Date().toISOString() });
}

export const dynamic = "force-dynamic";
