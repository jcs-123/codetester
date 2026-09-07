import Link from "next/link";

import { StatusBadge } from "@/components/tests/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TestListRow } from "@/lib/tests/queries";
import { testStatus } from "@/lib/tests/status";
import { formatDateTime, minutesLabel } from "@/lib/time";

export function TestList({ rows, showCreator, emptyMessage }: { rows: TestListRow[]; showCreator?: boolean; emptyMessage: string }) {
  const now = new Date();
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Test</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Class</TableHead>
            {showCreator && <TableHead>Created by</TableHead>}
            <TableHead>Window (IST)</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Questions</TableHead>
            <TableHead className="text-right">Submitted / Assigned</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={showCreator ? 10 : 9} className="py-10 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
          {rows.map(({ test, assigned, submitted, createdByName }) => (
            <TableRow key={test.id}>
              <TableCell className="font-medium">
                <Link href={`/tests/${test.id}`} className="hover:underline">
                  {test.name}
                </Link>
              </TableCell>
              <TableCell>
                <div className="font-mono text-xs">{test.subjectCode}</div>
                <div className="text-muted-foreground">{test.subjectName}</div>
              </TableCell>
              <TableCell>
                {test.department} · S{test.semester} · {test.batch}
              </TableCell>
              {showCreator && <TableCell>{createdByName ?? "—"}</TableCell>}
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDateTime(test.startsAt)}
                <br />→ {formatDateTime(test.closedAt && test.closedAt < test.endsAt ? test.closedAt : test.endsAt)}
              </TableCell>
              <TableCell>{minutesLabel(test.durationMinutes)}</TableCell>
              <TableCell>
                <StatusBadge status={testStatus(test, now)} />
              </TableCell>
              <TableCell className="text-right">{test.questionCount}</TableCell>
              <TableCell className="text-right">
                {submitted} / {assigned}
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/tests/${test.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Open
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
