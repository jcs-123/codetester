import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/permissions";
import { getTestForUser } from "@/lib/tests/queries";
import { formatDateTime, minutesLabel } from "@/lib/time";

export default async function TestOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("FACULTY", "ADMIN");
  const { id } = await params;
  const row = await getTestForUser(id, user);
  if (!row) notFound();
  const { test, assigned, attempted, submitted } = row;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Stat label="Assigned students" value={assigned} />
      <Stat label="Started" value={attempted} />
      <Stat label="Submitted" value={submitted} />

      <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <Row k="Subject" v={`${test.subjectCode} — ${test.subjectName}`} />
            <Row k="Class" v={`${test.department} · Semester ${test.semester} · Batch ${test.batch}`} />
            <Row k="Window" v={`${formatDateTime(test.startsAt)} → ${formatDateTime(test.endsAt)}`} />
            <Row k="Duration" v={minutesLabel(test.durationMinutes)} />
            <Row k="Questions" v={String(test.questionCount)} />
            <Row k="Correct answers shown" v={test.showAnswers === "AFTER_END" ? "After the window closes" : "Immediately after submission"} />
            <Row k="Created" v={formatDateTime(test.createdAt)} />
            {test.closedAt && <Row k="Closed early" v={formatDateTime(test.closedAt)} />}
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Instructions to students</dt>
              <dd className="mt-1 whitespace-pre-wrap">{test.instructions || <span className="text-muted-foreground">None</span>}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="mt-0.5">{v}</dd>
    </div>
  );
}
