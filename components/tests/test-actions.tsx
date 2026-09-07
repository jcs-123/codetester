"use client";

import { Pencil, RefreshCw, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { closeTestAction, deleteTestAction, extendTestAction, resyncAssignmentsAction } from "@/app/(app)/tests/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TestStatus } from "@/lib/tests/status";

export function TestActions({ testId, status, currentEndLocal }: { testId: string; status: TestStatus; currentEndLocal: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [extendOpen, setExtendOpen] = useState(false);
  const [newEnd, setNewEnd] = useState(currentEndLocal);

  const run = (fn: () => Promise<{ ok: true; data: unknown } | { ok: false; error: { message: string } }>, done: (data: unknown) => string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(done(res.data));
        router.refresh();
      } else toast.error(res.error.message);
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "SCHEDULED" && (
        <>
          <Link href={`/tests/${testId}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Pencil className="size-4" /> Edit
          </Link>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (!confirm("Delete this test? Students will no longer see it. This cannot be undone.")) return;
              start(async () => {
                const res = await deleteTestAction(testId);
                if (res.ok) {
                  toast.success("Test deleted");
                  router.push("/tests");
                } else toast.error(res.error.message);
              });
            }}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        </>
      )}

      {status === "LIVE" && (
        <>
          {extendOpen ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () => extendTestAction(testId, newEnd),
                  () => "End time extended",
                );
                setExtendOpen(false);
              }}
            >
              <Input type="datetime-local" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="h-8 w-56" required />
              <Button type="submit" size="sm" disabled={pending}>
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setExtendOpen(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setExtendOpen(true)} disabled={pending}>
              Extend end time
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (!confirm("Close the test now? Students still working will be submitted with their saved answers.")) return;
              run(
                () => closeTestAction(testId),
                (d) => `Test closed · ${(d as { finalized: number }).finalized} in-progress attempt(s) submitted`,
              );
            }}
          >
            <XCircle className="size-4" /> Close now
          </Button>
        </>
      )}

      {status !== "CLOSED" && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              () => resyncAssignmentsAction(testId),
              (d) => {
                const n = (d as { added: number }).added;
                return n ? `${n} newly matching student(s) added` : "Student list already up to date";
              },
            )
          }
        >
          <RefreshCw className="size-4" /> Re-sync students
        </Button>
      )}
    </div>
  );
}
