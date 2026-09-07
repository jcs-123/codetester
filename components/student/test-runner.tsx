"use client";

import { AlertTriangle, Check, Lightbulb, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { attemptStatusAction, revealHintAction, saveAnswerAction, submitAttemptAction } from "@/app/(app)/my-tests/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RunnerPayload } from "@/lib/tests/student-queries";
import { formatDurationMs } from "@/lib/time";
import { cn } from "@/lib/utils";

type SaveState = "saved" | "saving" | "error";
const LABELS = ["A", "B", "C", "D", "E", "F"];
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

export function TestRunner({ payload }: { payload: RunnerPayload }) {
  const router = useRouter();
  const storageKey = `attempt:${payload.attemptId}`;

  // Server-authoritative clock (SRS §7.5): the browser clock is only used to
  // advance a countdown whose origin is the server's own timestamp.
  const serverNowMs = useMemo(() => new Date(payload.serverNow).getTime(), [payload.serverNow]);
  const offsetRef = useRef<number | null>(null); // serverNow - Date.now(), measured once on the client
  const [deadline, setDeadline] = useState(() => new Date(payload.deadlineAt).getTime());
  const [remaining, setRemaining] = useState(() => new Date(payload.deadlineAt).getTime() - serverNowMs);
  const [failingLong, setFailingLong] = useState(false);

  const [answers, setAnswers] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(payload.questions.map((q) => [q.id, q.selectedOptionId])),
  );
  const [hints, setHints] = useState<Record<string, string>>(() =>
    Object.fromEntries(payload.questions.filter((q) => q.hint).map((q) => [q.id, q.hint!])),
  );
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [firstFailureAt, setFirstFailureAt] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const finishedRef = useRef(false);
  const retryTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const retryCount = useRef<Record<string, number>>({});
  const saveRef = useRef<(questionId: string, optionId: string | null) => Promise<void>>(async () => {});

  const answeredCount = Object.values(answers).filter(Boolean).length;
  const total = payload.questions.length;

  // ------------------------------------------------------------ finishing
  const finish = useCallback(
    (message?: string) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      try {
        sessionStorage.removeItem(storageKey);
      } catch {}
      if (message) toast.info(message);
      router.replace(`/my-tests/${payload.testId}/result`);
    },
    [router, payload.testId, storageKey],
  );

  const submit = useCallback(async () => {
    if (finishedRef.current) return;
    setSubmitting(true);
    const res = await submitAttemptAction(payload.attemptId);
    if (res.ok) finish();
    else if (res.error.code === "ATTEMPT_SUBMITTED" || res.error.code === "DEADLINE_PASSED") finish();
    else {
      setSubmitting(false);
      toast.error(res.error.message);
    }
  }, [payload.attemptId, finish]);

  // ------------------------------------------------------------ saving
  const save = useCallback(
    async (questionId: string, optionId: string | null) => {
      setSaveState((s) => ({ ...s, [questionId]: "saving" }));
      const res = await saveAnswerAction(payload.attemptId, questionId, optionId);
      if (res.ok) {
        retryCount.current[questionId] = 0;
        setSaveState((s) => {
          const next = { ...s, [questionId]: "saved" as SaveState };
          if (!Object.values(next).includes("error")) setFirstFailureAt(null);
          return next;
        });
        return;
      }
      if (res.error.code === "DEADLINE_PASSED" || res.error.code === "ATTEMPT_SUBMITTED") {
        finish("Time is up — your answers were submitted.");
        return;
      }
      if (res.error.code === "VALIDATION" || res.error.code === "FORBIDDEN") {
        toast.error(res.error.message);
        setSaveState((s) => ({ ...s, [questionId]: "error" }));
        return;
      }
      // Network / server hiccup: retry with back-off (SRS §7.6)
      setSaveState((s) => ({ ...s, [questionId]: "error" }));
      setFirstFailureAt((t) => t ?? Date.now());
      const n = retryCount.current[questionId] ?? 0;
      retryCount.current[questionId] = n + 1;
      const delay = RETRY_DELAYS[Math.min(n, RETRY_DELAYS.length - 1)]!;
      clearTimeout(retryTimers.current[questionId]);
      retryTimers.current[questionId] = setTimeout(() => void saveRef.current(questionId, optionId), delay);
    },
    [payload.attemptId, finish],
  );
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const select = (questionId: string, optionId: string | null) => {
    setAnswers((a) => {
      const next = { ...a, [questionId]: optionId };
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
    clearTimeout(retryTimers.current[questionId]);
    void save(questionId, optionId);
  };

  // Replay selections that were made but never confirmed by the server (e.g. refresh during an outage).
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (!raw) return;
        const local = JSON.parse(raw) as Record<string, string | null>;
        for (const q of payload.questions) {
          if (q.id in local && local[q.id] !== q.selectedOptionId) {
            setAnswers((a) => ({ ...a, [q.id]: local[q.id] ?? null }));
            void save(q.id, local[q.id] ?? null);
          }
        }
      } catch {}
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------ countdown
  useEffect(() => {
    const t = setInterval(() => {
      if (offsetRef.current === null) offsetRef.current = serverNowMs - Date.now();
      const left = deadline - (Date.now() + offsetRef.current);
      setRemaining(left);
      setFailingLong(firstFailureAt !== null && Date.now() - firstFailureAt > 15_000);
      if (left <= 0) void submit();
    }, 500);
    return () => clearInterval(t);
  }, [deadline, serverNowMs, submit, firstFailureAt]);

  // Heartbeat: notices an early close or an extended deadline (FR-STU-18, SRS §7.5).
  useEffect(() => {
    const t = setInterval(async () => {
      const res = await attemptStatusAction(payload.attemptId);
      if (!res.ok) return;
      if (res.data.submitted) finish("The test was closed by your faculty — your answers were submitted.");
      else setDeadline(new Date(res.data.deadlineAt).getTime());
    }, 30_000);
    return () => clearInterval(t);
  }, [payload.attemptId, finish]);

  // Warn before leaving (FR-STU-19) — answers are already saved, so never block.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (finishedRef.current) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const showHint = async (questionId: string) => {
    const res = await revealHintAction(payload.attemptId, questionId);
    if (res.ok) setHints((h) => ({ ...h, [questionId]: res.data.hint }));
    else if (res.error.code === "DEADLINE_PASSED" || res.error.code === "ATTEMPT_SUBMITTED") finish();
    else toast.error(res.error.message);
  };

  const urgency = remaining <= 60_000 ? "text-red-600" : remaining <= 5 * 60_000 ? "text-amber-600" : "";
  const unanswered = total - answeredCount;

  return (
    <div className="-m-4 md:-m-6">
      <header className="sticky top-0 z-10 border-b bg-card/95 px-4 py-2 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{payload.testName}</div>
            <div className="truncate text-xs text-muted-foreground">{payload.subject}</div>
          </div>
          <div className="text-right">
            <div className={cn("font-mono text-xl font-semibold tabular-nums", urgency)} aria-live="polite">
              {formatDurationMs(remaining)}
            </div>
            <div className="text-xs text-muted-foreground">
              {answeredCount} of {total} answered
            </div>
          </div>
          <Button onClick={() => setConfirmOpen(true)} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </div>
        {failingLong && (
          <div className="mx-auto mt-2 flex max-w-3xl items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="size-4 shrink-0" />
            Some answers could not be saved yet — check your connection. We keep retrying automatically.
          </div>
        )}
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4 md:px-6">
        {payload.questions.map((q, i) => {
          const selected = answers[q.id] ?? null;
          const st = saveState[q.id];
          return (
            <section key={q.id} id={`q-${i + 1}`} className="rounded-lg border bg-card p-4" tabIndex={-1}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <h2 className="text-base font-medium">
                  <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                  <span className="whitespace-pre-wrap">{q.text}</span>
                </h2>
                <span className="shrink-0 text-xs text-muted-foreground" aria-live="polite">
                  {st === "saving" && (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="size-3 animate-spin" /> Saving…
                    </span>
                  )}
                  {st === "saved" && (
                    <span className="inline-flex items-center gap-1 text-green-700">
                      <Check className="size-3" /> Saved
                    </span>
                  )}
                  {st === "error" && (
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      <RefreshCw className="size-3" /> Not saved — retrying
                    </span>
                  )}
                </span>
              </div>

              <div role="radiogroup" aria-label={`Question ${i + 1}`} className="grid gap-2">
                {q.options.map((o, oi) => {
                  const checked = selected === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      onClick={() => select(q.id, checked ? null : o.id)}
                      className={cn(
                        "flex min-h-11 items-start gap-3 rounded-md border px-3 py-2.5 text-left text-base transition-colors",
                        checked ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                          checked ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground",
                        )}
                      >
                        {LABELS[oi]}
                      </span>
                      <span className="whitespace-pre-wrap">{o.text}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {q.hasHint &&
                  (hints[q.id] ? (
                    <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      <Lightbulb className="mt-0.5 size-4 shrink-0" />
                      <span>{hints[q.id]}</span>
                    </p>
                  ) : (
                    <Button type="button" variant="ghost" size="sm" onClick={() => void showHint(q.id)}>
                      <Lightbulb className="size-4" /> Show hint
                    </Button>
                  ))}
                {selected && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => select(q.id, null)}>
                    Clear answer
                  </Button>
                )}
              </div>
            </section>
          );
        })}

        <div className="flex justify-end pb-8">
          <Button size="lg" onClick={() => setConfirmOpen(true)} disabled={submitting}>
            Submit test
          </Button>
        </div>
      </main>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit the test?</DialogTitle>
            <DialogDescription>
              {unanswered > 0
                ? `${unanswered} question${unanswered === 1 ? " is" : "s are"} unanswered and will score 0. `
                : "All questions are answered. "}
              Submission is final — you cannot reopen the test.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Keep working</DialogClose>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                void submit();
              }}
              disabled={submitting}
            >
              Submit now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
