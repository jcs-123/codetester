"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { startAttemptAction } from "@/app/(app)/my-tests/actions";
import { Button } from "@/components/ui/button";

export function StartTestButton({ testId, resume }: { testId: string; resume: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={() => {
        if (!resume && !confirm("Start the test now? The timer starts immediately and cannot be paused.")) return;
        start(async () => {
          const res = await startAttemptAction(testId);
          if (res && !res.ok) toast.error(res.error.message);
        });
      }}
    >
      {pending ? "Starting…" : resume ? "Resume test" : "Start test"}
    </Button>
  );
}
