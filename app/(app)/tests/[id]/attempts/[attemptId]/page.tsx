import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/permissions";
import { getTestForUser } from "@/lib/tests/queries";
import { ATTEMPT_STATUS_LABEL, attemptStatus, getAttemptDetail } from "@/lib/tests/results-queries";
import { percentage } from "@/lib/tests/scoring";
import { formatDateTime, formatDateTimeSeconds, formatDurationMs } from "@/lib/time";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AttemptDetailPage({ params }: { params: Promise<{ id: string; attemptId: string }> }) {
  const user = await requireRole("FACULTY", "ADMIN");
  const { id, attemptId } = await params;
  const row = await getTestForUser(id, user);
  if (!row) notFound();
  const detail = await getAttemptDetail(attemptId);
  if (!detail || detail.test.id !== id) notFound();
  const { attempt, student, questions } = detail;
  const status = attemptStatus(attempt);
  const submitted = Boolean(attempt.submittedAt);

  return (
    <div className="space-y-4">
      <Link href={`/tests/${id}/results`} className="text-sm text-muted-foreground hover:underline">
        ← Results
      </Link>
      <div className="rounded-md border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">
            {student.name} <span className="font-mono text-sm text-muted-foreground">{student.loginId}</span>
          </h2>
          <Badge variant={submitted ? "default" : "secondary"}>{ATTEMPT_STATUS_LABEL[status]}</Badge>
          {attempt.supersededAt && <Badge variant="destructive">Reset</Badge>}
        </div>
        <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
          <Item k="Score" v={submitted ? `${attempt.score} / ${attempt.totalQuestions} (${percentage(attempt.score ?? 0, attempt.totalQuestions ?? 0)}%)` : "—"} />
          <Item k="Started" v={formatDateTime(attempt.startedAt)} />
          <Item k="Submitted" v={submitted ? formatDateTime(attempt.submittedAt) : "—"} />
          <Item k="Time taken" v={submitted ? formatDurationMs(attempt.submittedAt!.getTime() - attempt.startedAt.getTime()) : "—"} />
        </dl>
      </div>

      <ol className="space-y-3">
        {questions.map((q) => (
          <li key={q.id} className="rounded-md border p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">
                <span className="mr-2 text-muted-foreground">{q.number}.</span>
                <span className="whitespace-pre-wrap">{q.text}</span>
              </p>
              <span
                className={cn(
                  "shrink-0 text-sm font-medium",
                  q.outcome === "correct" ? "text-green-700" : q.outcome === "incorrect" ? "text-red-600" : "text-muted-foreground",
                )}
              >
                {q.outcome === "correct" ? "Correct" : q.outcome === "incorrect" ? "Incorrect" : "Unanswered"}
              </span>
            </div>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {q.options.map((o) => {
                const chosen = o.id === q.chosenOptionId;
                const correct = o.id === q.correctOptionId;
                return (
                  <li
                    key={o.id}
                    className={cn(
                      "flex gap-2 rounded-md border px-3 py-1.5 text-sm",
                      correct && "border-green-600 bg-green-50",
                      chosen && !correct && "border-red-500 bg-red-50",
                    )}
                  >
                    <span className="w-4 shrink-0">{o.label}.</span>
                    <span className="flex-1 whitespace-pre-wrap">{o.text}</span>
                    {chosen && <span className="text-xs text-muted-foreground">chosen</span>}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              {q.hintUsed ? "Hint used" : "Hint not used"}
              {q.answeredAt && <> · last changed {formatDateTimeSeconds(q.answeredAt)}</>}
            </p>
          </li>
        ))}
      </ol>
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
