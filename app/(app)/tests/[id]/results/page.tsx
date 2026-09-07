import { Download } from "lucide-react";
import { notFound } from "next/navigation";

import { AutoRefresh } from "@/components/auto-refresh";
import { ResultsTable, type ResultsTableRow } from "@/components/tests/results-table";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/permissions";
import { finalizeExpiredAttempts } from "@/lib/tests/attempts";
import { canManageTest, getTestForUser } from "@/lib/tests/queries";
import { listResults, scorePercent, summarize } from "@/lib/tests/results-queries";
import { testStatus } from "@/lib/tests/status";
import { formatDateTime, formatDurationMs } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function TestResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("FACULTY", "ADMIN");
  const { id } = await params;
  const row = await getTestForUser(id, user);
  if (!row) notFound();
  const { test } = row;

  await finalizeExpiredAttempts();
  const rows = await listResults(id);
  const summary = summarize(rows, test.questionCount);
  const live = testStatus(test) === "LIVE";

  const tableRows: ResultsTableRow[] = rows.map((r) => ({
    studentId: r.studentId,
    loginId: r.loginId,
    name: r.name,
    batch: r.batch ?? "",
    status: r.status,
    attemptId: r.attempt?.id ?? null,
    score: r.attempt?.submittedAt ? (r.attempt.score ?? 0) : null,
    total: r.attempt?.totalQuestions ?? test.questionCount,
    percent: scorePercent(r.attempt),
    timeTaken: r.attempt?.submittedAt ? formatDurationMs(r.attempt.submittedAt.getTime() - r.attempt.startedAt.getTime()) : "",
    submittedAt: r.attempt?.submittedAt ? formatDateTime(r.attempt.submittedAt) : "",
    hintsUsed: r.attempt?.hintsUsed ?? 0,
  }));

  return (
    <div className="space-y-4">
      {live && <AutoRefresh intervalMs={30_000} />}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Assigned" value={summary.assigned} />
        <Stat label="Started" value={summary.started} />
        <Stat label="Submitted" value={summary.submitted} />
        <Stat label="Average" value={summary.average ?? "—"} suffix={summary.average !== null ? ` / ${summary.total}` : ""} />
        <Stat label="Highest" value={summary.highest ?? "—"} />
        <Stat label="Lowest" value={summary.lowest ?? "—"} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {live ? "Live — this page refreshes every 30 seconds." : "Final results."}
        </p>
        <a href={`/api/tests/${id}/export`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Download className="size-4" /> Download results (Excel)
        </a>
      </div>
      <ResultsTable rows={tableRows} testId={id} canReset={canManageTest(test, user) && live} />
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number | string; suffix?: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">
        {value}
        {suffix && <span className="text-sm font-normal text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}
