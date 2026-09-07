import { desc, eq } from "drizzle-orm";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { importJobs, users } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/time";

export default async function ImportHistoryPage() {
  const jobs = await db
    .select({
      id: importJobs.id,
      type: importJobs.type,
      fileName: importJobs.fileName,
      rowsCreated: importJobs.rowsCreated,
      rowsUpdated: importJobs.rowsUpdated,
      createdAt: importJobs.createdAt,
      uploadedBy: users.name,
    })
    .from(importJobs)
    .leftJoin(users, eq(users.id, importJobs.uploadedById))
    .orderBy(desc(importJobs.createdAt))
    .limit(200);

  return (
    <>
      <PageHeader
        title="Import history"
        description="Every Excel import, with who ran it and what changed."
        actions={
          <Link href="/admin/users/import" className={buttonVariants()}>
            New import
          </Link>
        }
      />
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>List</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Imported by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No imports yet.
                </TableCell>
              </TableRow>
            )}
            {jobs.map((j) => (
              <TableRow key={j.id}>
                <TableCell>{formatDateTime(j.createdAt)}</TableCell>
                <TableCell>{j.type === "STUDENT" ? "Students" : "Faculty"}</TableCell>
                <TableCell className="font-mono text-xs">{j.fileName}</TableCell>
                <TableCell>{j.rowsCreated}</TableCell>
                <TableCell>{j.rowsUpdated}</TableCell>
                <TableCell>{j.uploadedBy ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
