"use client";

import { ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { resetAttemptAction } from "@/app/(app)/tests/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ATTEMPT_STATUS_LABEL, type AttemptStatus } from "@/lib/tests/attempt-status";
import { cn } from "@/lib/utils";

export type ResultsTableRow = {
  studentId: string;
  loginId: string;
  name: string;
  batch: string;
  status: AttemptStatus;
  attemptId: string | null;
  score: number | null;
  total: number;
  percent: number | null;
  timeTaken: string;
  submittedAt: string;
  hintsUsed: number;
};

type SortKey = "loginId" | "name" | "status" | "score" | "submittedAt";

export function ResultsTable({ rows, testId, canReset }: { rows: ResultsTableRow[]; testId: string; canReset: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "loginId", dir: 1 });
  const [pending, start] = useTransition();

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle ? rows.filter((r) => r.loginId.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle)) : rows;
    const val = (r: ResultsTableRow) => (sort.key === "score" ? (r.score ?? -1) : r[sort.key]);
    return [...filtered].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [rows, q, sort]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const reset = (row: ResultsTableRow) => {
    if (!row.attemptId) return;
    const reason = prompt(`Reset the attempt of ${row.name} (${row.loginId})? Their answers will be archived and they can start again.\n\nReason:`);
    if (reason === null) return;
    start(async () => {
      const res = await resetAttemptAction(row.attemptId!, reason);
      if (res.ok) {
        toast.success("Attempt reset");
        router.refresh();
      } else toast.error(res.error.message);
    });
  };

  const th = (k: SortKey, label: string, className?: string) => (
    <TableHead className={className}>
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        <ArrowUpDown className={cn("size-3", sort.key === k ? "opacity-100" : "opacity-30")} />
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-3">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by ID or name" className="w-64" />
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {th("loginId", "Student ID")}
              {th("name", "Name")}
              <TableHead>Batch</TableHead>
              {th("status", "Status")}
              {th("score", "Score", "text-right")}
              <TableHead className="text-right">%</TableHead>
              <TableHead>Time taken</TableHead>
              {th("submittedAt", "Submitted at")}
              <TableHead className="text-right">Hints</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                  No students match.
                </TableCell>
              </TableRow>
            )}
            {visible.map((r) => (
              <TableRow key={r.studentId}>
                <TableCell className="font-mono text-xs">{r.loginId}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.batch}</TableCell>
                <TableCell>
                  <StatusPill status={r.status} />
                </TableCell>
                <TableCell className="text-right">{r.score === null ? "—" : `${r.score} / ${r.total}`}</TableCell>
                <TableCell className="text-right">{r.percent === null ? "—" : `${r.percent}%`}</TableCell>
                <TableCell>{r.timeTaken || "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{r.submittedAt || "—"}</TableCell>
                <TableCell className="text-right">{r.attemptId ? r.hintsUsed : "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {r.attemptId && (
                      <Link href={`/tests/${testId}/attempts/${r.attemptId}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                        View
                      </Link>
                    )}
                    {canReset && r.attemptId && (
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => reset(r)}>
                        Reset
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: AttemptStatus }) {
  const variant = status === "NOT_STARTED" ? "outline" : status === "IN_PROGRESS" ? "secondary" : "default";
  return <Badge variant={variant}>{ATTEMPT_STATUS_LABEL[status]}</Badge>;
}
