"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { importUsersCommit, importUsersPreview, type ImportPreviewData } from "@/app/(app)/admin/users/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Step = { n: 1 } | { n: 2; preview: ImportPreviewData } | { n: 3; created: number; updated: number; type: string };

export function ImportWizard() {
  const [step, setStep] = useState<Step>({ n: 1 });
  const [type, setType] = useState<"STUDENT" | "FACULTY">("STUDENT");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const upload = (formData: FormData) => {
    setError(null);
    start(async () => {
      const res = await importUsersPreview(formData);
      if (res.ok) setStep({ n: 2, preview: res.data });
      else setError(res.error.message);
    });
  };

  const commit = (preview: ImportPreviewData) => {
    setError(null);
    start(async () => {
      const res = await importUsersCommit(preview.previewId);
      if (res.ok) setStep({ n: 3, ...res.data, type: preview.type });
      else setError(res.error.message);
    });
  };

  return (
    <div className="space-y-6">
      <Steps current={step.n} />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step.n === 1 && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>1. Choose the list and upload the file</CardTitle>
            <CardDescription>Use the template so the column headers match. Existing IDs are updated; new IDs are created.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={upload} className="space-y-5">
              <div className="flex gap-6 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="type" value="STUDENT" checked={type === "STUDENT"} onChange={() => setType("STUDENT")} />
                  Students
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="type" value="FACULTY" checked={type === "FACULTY"} onChange={() => setType("FACULTY")} />
                  Faculty
                </label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="file">Excel file (.xlsx, max 5 MB)</Label>
                <Input id="file" name="file" type="file" accept=".xlsx" required />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={pending}>
                  {pending ? "Checking file…" : "Upload and preview"}
                </Button>
                <a
                  href={`/api/templates/${type === "STUDENT" ? "students" : "faculty"}`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  <Download className="size-4" /> Download {type === "STUDENT" ? "student" : "faculty"} template
                </a>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step.n === 2 && (
        <PreviewStep
          preview={step.preview}
          pending={pending}
          onBack={() => setStep({ n: 1 })}
          onCommit={() => commit(step.preview)}
        />
      )}

      {step.n === 3 && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Import complete</CardTitle>
            <CardDescription>
              {step.created} account{step.created === 1 ? "" : "s"} created, {step.updated} updated.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Link href={`/admin/users?tab=${step.type === "STUDENT" ? "students" : "faculty"}`} className={buttonVariants()}>
              View users
            </Link>
            <Button variant="outline" onClick={() => setStep({ n: 1 })}>
              Import another file
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PreviewStep({
  preview,
  pending,
  onBack,
  onCommit,
}: {
  preview: ImportPreviewData;
  pending: boolean;
  onBack: () => void;
  onCommit: () => void;
}) {
  const { summary, errors, sample } = preview;
  const hasErrors = summary.errorCount > 0;
  const isStudent = preview.type === "STUDENT";

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Rows in file" value={summary.total} />
        <Stat label="To create" value={summary.toCreate} />
        <Stat label="To update" value={summary.toUpdate} />
        <Stat label="Errors" value={summary.errorCount} tone={hasErrors ? "bad" : "good"} />
      </div>

      {hasErrors ? (
        <Alert variant="destructive">
          <AlertTitle>The file cannot be imported until every error is fixed</AlertTitle>
          <AlertDescription>
            Fix the rows listed below in your Excel file and upload it again. Nothing has been saved.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertTitle>Ready to import {preview.fileName}</AlertTitle>
          <AlertDescription>
            {summary.toCreate} new account{summary.toCreate === 1 ? "" : "s"} will be created and {summary.toUpdate} existing
            account{summary.toUpdate === 1 ? "" : "s"} updated. New users sign in with the password from the file.
          </AlertDescription>
        </Alert>
      )}

      {hasErrors && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Errors</CardTitle>
              <CardDescription>
                Showing {Math.min(errors.length, 200)} of {summary.errorCount}
              </CardDescription>
            </div>
            <a href={`/api/admin/imports/${preview.previewId}/errors`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Download className="size-4" /> Download all errors
            </a>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Row</TableHead>
                  <TableHead className="w-40">Column</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell>{e.row}</TableCell>
                    <TableCell>{e.column}</TableCell>
                    <TableCell>{e.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!hasErrors && sample.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>First {sample.length} rows as they will be saved.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  {isStudent ? (
                    <>
                      <TableHead>Sem</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Adm. year</TableHead>
                    </>
                  ) : (
                    <TableHead>Designation</TableHead>
                  )}
                  <TableHead>Password</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sample.map((r) => (
                  <TableRow key={r.row}>
                    <TableCell>{r.row}</TableCell>
                    <TableCell>
                      {r.status === "create" ? <Badge>Create</Badge> : <Badge variant="secondary">Update</Badge>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.loginId}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.email}</TableCell>
                    <TableCell>{r.department}</TableCell>
                    {isStudent ? (
                      <>
                        <TableCell>{r.semester}</TableCell>
                        <TableCell>{r.batch}</TableCell>
                        <TableCell>{r.admissionYear}</TableCell>
                      </>
                    ) : (
                      <TableCell>{r.designation}</TableCell>
                    )}
                    <TableCell className="text-muted-foreground">{r.password ? "set" : "unchanged"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} disabled={pending}>
          Upload a different file
        </Button>
        {!hasErrors && (
          <Button onClick={onCommit} disabled={pending}>
            {pending ? "Importing…" : `Confirm import (${summary.toCreate + summary.toUpdate} rows)`}
          </Button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-md border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-semibold", tone === "bad" && value > 0 && "text-destructive", tone === "good" && "text-green-700")}>
        {value}
      </div>
    </div>
  );
}

function Steps({ current }: { current: 1 | 2 | 3 }) {
  const labels = ["Upload", "Preview", "Done"];
  return (
    <ol className="flex items-center gap-3 text-sm">
      {labels.map((l, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        return (
          <li key={l} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                n === current ? "bg-primary text-primary-foreground" : n < current ? "bg-muted text-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {n}
            </span>
            <span className={cn(n === current ? "font-medium" : "text-muted-foreground")}>{l}</span>
            {i < labels.length - 1 && <span className="mx-1 h-px w-8 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
