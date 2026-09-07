import { CalendarClock, CheckCircle2, PlayCircle } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/tests/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/permissions";
import { finalizeExpiredAttempts } from "@/lib/tests/attempts";
import { percentage } from "@/lib/tests/scoring";
import { effectiveEndsAt, testStatus } from "@/lib/tests/status";
import { listStudentTests, type StudentTestRow } from "@/lib/tests/student-queries";
import { formatDateTime, minutesLabel } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function MyTestsPage() {
  const user = await requireRole("STUDENT");
  await finalizeExpiredAttempts(); // lazy path (SRS §7.1)
  const rows = await listStudentTests(user.id);
  const now = new Date();

  const toTake = rows
    .filter((r) => testStatus(r.test, now) === "LIVE" && !r.attempt?.submittedAt)
    .sort((a, b) => effectiveEndsAt(a.test).getTime() - effectiveEndsAt(b.test).getTime());
  const upcoming = rows
    .filter((r) => testStatus(r.test, now) === "SCHEDULED")
    .sort((a, b) => a.test.startsAt.getTime() - b.test.startsAt.getTime());
  const completed = rows
    .filter((r) => r.attempt?.submittedAt)
    .sort((a, b) => b.attempt!.submittedAt!.getTime() - a.attempt!.submittedAt!.getTime());
  const missed = rows.filter((r) => testStatus(r.test, now) === "CLOSED" && !r.attempt?.submittedAt);

  return (
    <>
      <PageHeader title="My tests" description={`Signed in as ${user.name} (${user.loginId}).`} />

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <PlayCircle className="size-5 text-green-600" /> Tests to take
        </h2>
        {toTake.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tests are open right now.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {toTake.map((r) => (
              <TestCard key={r.test.id} row={r} now={now}>
                <Link href={`/my-tests/${r.test.id}`} className={buttonVariants()}>
                  {r.attempt ? "Resume test" : "Start test"}
                </Link>
              </TestCard>
            ))}
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-muted-foreground">
            <CalendarClock className="size-5" /> Upcoming
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {upcoming.map((r) => (
              <TestCard key={r.test.id} row={r} now={now} muted>
                <span className="text-sm text-muted-foreground">Opens {formatDateTime(r.test.startsAt)}</span>
              </TestCard>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <CheckCircle2 className="size-5 text-primary" /> Completed tests
        </h2>
        {completed.length === 0 && missed.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have not taken any tests yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {completed.map((r) => (
              <TestCard key={r.test.id} row={r} now={now}>
                <div className="flex items-center gap-3">
                  <span className="text-sm">
                    <span className="text-lg font-semibold">{r.attempt!.score}</span>
                    <span className="text-muted-foreground"> / {r.attempt!.totalQuestions}</span>
                    <span className="ml-2 text-muted-foreground">({percentage(r.attempt!.score ?? 0, r.attempt!.totalQuestions ?? 0)}%)</span>
                  </span>
                  <Link href={`/my-tests/${r.test.id}/result`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    View result
                  </Link>
                </div>
              </TestCard>
            ))}
            {missed.map((r) => (
              <TestCard key={r.test.id} row={r} now={now} muted>
                <Badge variant="outline">Not taken</Badge>
              </TestCard>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function TestCard({ row, now, muted, children }: { row: StudentTestRow; now: Date; muted?: boolean; children: React.ReactNode }) {
  const { test, facultyName, attempt } = row;
  return (
    <Card className={muted ? "opacity-75" : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="leading-snug">{test.name}</CardTitle>
          <StatusBadge status={testStatus(test, now)} />
        </div>
        <CardDescription>
          {test.subjectCode} · {test.subjectName}
          {facultyName && <> · {facultyName}</>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="text-muted-foreground">
          {formatDateTime(test.startsAt)} → {formatDateTime(effectiveEndsAt(test))} · {minutesLabel(test.durationMinutes)} · {test.questionCount} questions
          {attempt?.submittedAt && <> · submitted {formatDateTime(attempt.submittedAt)}</>}
        </div>
        <div>{children}</div>
      </CardContent>
    </Card>
  );
}
