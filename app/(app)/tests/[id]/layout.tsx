import { notFound } from "next/navigation";

import { TestActions } from "@/components/tests/test-actions";
import { TestTabs } from "@/components/tests/test-tabs";
import { StatusBadge } from "@/components/tests/status-badge";
import { requireRole } from "@/lib/permissions";
import { canManageTest, getTestForUser } from "@/lib/tests/queries";
import { testStatus } from "@/lib/tests/status";
import { formatDateTime, minutesLabel, toDateTimeLocalValue } from "@/lib/time";

export default async function TestLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const user = await requireRole("FACULTY", "ADMIN");
  const { id } = await params;
  const row = await getTestForUser(id, user);
  if (!row) notFound();
  const { test } = row;
  const status = testStatus(test);
  const manage = canManageTest(test, user);

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{test.name}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {test.subjectCode} · {test.subjectName} · {test.department} · Semester {test.semester} · Batch {test.batch}
            {row.createdByName && user.role === "ADMIN" && <> · by {row.createdByName}</>}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateTime(test.startsAt)} → {formatDateTime(test.endsAt)} · {minutesLabel(test.durationMinutes)} · {test.questionCount} questions
            {test.closedAt && <> · closed early at {formatDateTime(test.closedAt)}</>}
          </p>
        </div>
        {manage && <TestActions testId={test.id} status={status} currentEndLocal={toDateTimeLocalValue(test.endsAt)} />}
      </div>
      <TestTabs testId={test.id} />
      <div className="mt-6">{children}</div>
    </>
  );
}
