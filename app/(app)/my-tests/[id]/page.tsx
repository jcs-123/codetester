import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { StartTestButton } from "@/components/student/start-test-button";
import { StatusBadge } from "@/components/tests/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/permissions";
import { effectiveEndsAt, testStatus } from "@/lib/tests/status";
import { getStudentTest } from "@/lib/tests/student-queries";
import { formatDateTime, minutesLabel } from "@/lib/time";

import { finalizeIfExpired } from "../actions";

export const dynamic = "force-dynamic";

export default async function InstructionsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("STUDENT");
  const { id } = await params;
  const row = await getStudentTest(id, user.id);
  if (!row) notFound();
  const { test, attempt, facultyName } = row;

  if (attempt) {
    const finalized = await finalizeIfExpired(attempt, test);
    if (attempt.submittedAt || finalized) redirect(`/my-tests/${id}/result`);
    redirect(`/my-tests/${id}/attempt`);
  }

  const now = new Date();
  const status = testStatus(test, now);
  const end = effectiveEndsAt(test);
  const minutesLeftInWindow = Math.floor((end.getTime() - now.getTime()) / 60_000);
  const shortened = status === "LIVE" && minutesLeftInWindow < test.durationMinutes;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/my-tests" className="text-sm text-muted-foreground hover:underline">
        ← My tests
      </Link>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-xl">{test.name}</CardTitle>
            <StatusBadge status={status} />
          </div>
          <CardDescription>
            {test.subjectCode} · {test.subjectName}
            {facultyName && <> · {facultyName}</>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Item k="Open from" v={formatDateTime(test.startsAt)} />
            <Item k="Closes at" v={formatDateTime(end)} />
            <Item k="Duration" v={minutesLabel(test.durationMinutes)} />
            <Item k="Questions" v={`${test.questionCount} (1 mark each, no negative marking)`} />
          </dl>

          {test.instructions && (
            <div>
              <h3 className="mb-1 text-sm font-medium">Instructions from your faculty</h3>
              <p className="whitespace-pre-wrap text-sm">{test.instructions}</p>
            </div>
          )}

          <div>
            <h3 className="mb-1 text-sm font-medium">Rules</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>You can take this test only once. The timer starts when you press Start and cannot be paused.</li>
              <li>Every answer is saved automatically. If your connection drops or the browser closes, open the test again to continue.</li>
              <li>When the time runs out, whatever you have saved is submitted automatically.</li>
              <li>Questions that have a hint show a &quot;Show hint&quot; button. Using a hint does not affect your marks.</li>
              <li>
                Correct answers and explanations are shown{" "}
                {test.showAnswers === "IMMEDIATELY" ? "right after you submit." : "after the test closes for everyone."}
              </li>
            </ul>
          </div>

          {shortened && (
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertTitle>Less than the full duration is left</AlertTitle>
              <AlertDescription>
                The test closes at {formatDateTime(end)}, so you will have about {Math.max(1, minutesLeftInWindow)} minute
                {minutesLeftInWindow === 1 ? "" : "s"} instead of {test.durationMinutes}.
              </AlertDescription>
            </Alert>
          )}

          {status === "LIVE" ? (
            <StartTestButton testId={test.id} resume={false} />
          ) : status === "SCHEDULED" ? (
            <p className="text-sm text-muted-foreground">This test opens at {formatDateTime(test.startsAt)}.</p>
          ) : (
            <p className="text-sm text-muted-foreground">This test has closed.</p>
          )}
          {status !== "LIVE" && (
            <Link href="/my-tests" className={buttonVariants({ variant: "outline" })}>
              Back to my tests
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
