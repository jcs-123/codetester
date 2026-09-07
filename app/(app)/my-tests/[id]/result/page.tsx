import { CheckCircle2, Clock, Lightbulb, MinusCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/permissions";
import { percentage } from "@/lib/tests/scoring";
import { answersVisible, effectiveEndsAt } from "@/lib/tests/status";
import { getReviewPayload, getStudentTest } from "@/lib/tests/student-queries";
import { formatDateTime, formatDurationMs } from "@/lib/time";
import { cn } from "@/lib/utils";

import { finalizeIfExpired } from "../../actions";

export const dynamic = "force-dynamic";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("STUDENT");
  const { id } = await params;
  const row = await getStudentTest(id, user.id);
  if (!row) notFound();
  const { test } = row;
  let { attempt } = row;
  if (!attempt) redirect(`/my-tests/${id}`);

  if (!attempt.submittedAt) {
    const finalized = await finalizeIfExpired(attempt, test);
    if (!finalized) redirect(`/my-tests/${id}/attempt`);
    const fresh = await getStudentTest(id, user.id);
    attempt = fresh?.attempt ?? attempt;
  }

  const now = new Date();
  const visible = answersVisible(test, Boolean(attempt.submittedAt), now);
  const review = await getReviewPayload(attempt, test, visible);
  const score = attempt.score ?? 0;
  const total = attempt.totalQuestions ?? test.questionCount;
  const timeTaken = attempt.submittedAt ? attempt.submittedAt.getTime() - attempt.startedAt.getTime() : 0;
  const submitLabel =
    attempt.submitType === "TIMEOUT" ? "Auto-submitted (time up)" : attempt.submitType === "CLOSED" ? "Auto-submitted (test closed)" : "Submitted";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/my-tests" className="text-sm text-muted-foreground hover:underline">
        ← My tests
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{test.name}</CardTitle>
          <CardDescription>
            {test.subjectCode} · {test.subjectName} · {submitLabel} {formatDateTime(attempt.submittedAt)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Score" value={`${score} / ${total}`} big />
            <Stat label="Percentage" value={`${percentage(score, total)}%`} />
            <Stat label="Time taken" value={formatDurationMs(timeTaken)} />
          </div>
        </CardContent>
      </Card>

      {!visible && (
        <Alert>
          <Clock className="size-4" />
          <AlertTitle>Correct answers will be available after {formatDateTime(effectiveEndsAt(test))}</AlertTitle>
          <AlertDescription>
            Your faculty has chosen to show answers and explanations once the test closes for everyone. Come back to this page after that time.
          </AlertDescription>
        </Alert>
      )}

      <ol className="space-y-4">
        {review.map((q, i) => (
          <li key={q.id} className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="font-medium">
                <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                <span className="whitespace-pre-wrap">{q.text}</span>
              </h2>
              {q.outcome && <Outcome outcome={q.outcome} />}
            </div>
            <ul className="grid gap-2">
              {q.options.map((o) => {
                const isSelected = o.id === q.selectedOptionId;
                const isCorrect = visible && o.id === q.correctOptionId;
                return (
                  <li
                    key={o.id}
                    className={cn(
                      "flex items-start gap-3 rounded-md border px-3 py-2 text-sm",
                      isCorrect && "border-green-600 bg-green-50",
                      isSelected && !isCorrect && visible && "border-red-500 bg-red-50",
                      isSelected && !visible && "border-primary bg-primary/10",
                    )}
                  >
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">{o.label}</span>
                    <span className="flex-1 whitespace-pre-wrap">{o.text}</span>
                    {isSelected && <span className="shrink-0 text-xs text-muted-foreground">your answer</span>}
                    {isCorrect && <span className="shrink-0 text-xs font-medium text-green-700">correct</span>}
                  </li>
                );
              })}
            </ul>
            {visible && (q.explanation || q.hint) && (
              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                {q.explanation && (
                  <p>
                    <span className="font-medium text-foreground">Explanation:</span> {q.explanation}
                  </p>
                )}
                {q.hint && (
                  <p className="flex items-start gap-1">
                    <Lightbulb className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      {q.hint}
                      {q.hintUsed && <span className="ml-1 text-xs">(you used this hint)</span>}
                    </span>
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className="pb-8">
        <Link href="/my-tests" className={buttonVariants({ variant: "outline" })}>
          Back to my tests
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="rounded-md border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("font-semibold", big ? "text-3xl" : "text-2xl")}>{value}</div>
    </div>
  );
}

function Outcome({ outcome }: { outcome: "correct" | "incorrect" | "unanswered" }) {
  if (outcome === "correct")
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-green-700">
        <CheckCircle2 className="size-4" /> Correct
      </span>
    );
  if (outcome === "incorrect")
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-red-600">
        <XCircle className="size-4" /> Incorrect
      </span>
    );
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground">
      <MinusCircle className="size-4" /> Unanswered
    </span>
  );
}
