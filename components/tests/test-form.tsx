"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState, useTransition } from "react";

import { parseQuestionFileAction, saveTestAction, type QuestionPreviewData, type TestFormState } from "@/app/(app)/tests/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { Test } from "@/lib/db/schema";
import type { ClassOption } from "@/lib/tests/queries";
import { toDateTimeLocalValue } from "@/lib/time";
import { cn } from "@/lib/utils";

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs";

export function TestForm({ test, classes }: { test?: Test; classes: ClassOption[] }) {
  const [state, action, pending] = useActionState<TestFormState, FormData>(saveTestAction, {});
  const err = (k: string) => state.fields?.[k];

  // Class pickers ------------------------------------------------------------
  const [department, setDepartment] = useState(test?.department ?? "");
  const [semester, setSemester] = useState(test ? String(test.semester) : "");
  const [batch, setBatch] = useState(test?.batch ?? "");
  const departments = useMemo(() => [...new Set(classes.map((c) => c.department))], [classes]);
  const semesters = useMemo(
    () => [...new Set(classes.filter((c) => c.department === department).map((c) => c.semester))].sort((a, b) => a - b),
    [classes, department],
  );
  const batches = useMemo(
    () => classes.filter((c) => c.department === department && String(c.semester) === semester).map((c) => c.batch),
    [classes, department, semester],
  );
  const studentCount = classes.find((c) => c.department === department && String(c.semester) === semester && c.batch === batch)?.students;

  // Question file ------------------------------------------------------------
  const [preview, setPreview] = useState<QuestionPreviewData | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();

  const checkFile = (input: HTMLInputElement | null) => {
    const file = input?.files?.[0];
    if (!file) {
      setFileError("Choose an .xlsx file first.");
      return;
    }
    setFileError(null);
    const fd = new FormData();
    fd.set("file", file);
    startCheck(async () => {
      const res = await parseQuestionFileAction(fd);
      if (res.ok) setPreview(res.data);
      else setFileError(res.error.message);
    });
  };

  const previewOk = preview && preview.errors.length === 0 && preview.questions.length > 0;

  return (
    <form action={action} className="space-y-6" noValidate>
      {test && <input type="hidden" name="id" value={test.id} />}
      {previewOk && <input type="hidden" name="previewId" value={preview.previewId} />}

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Test details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Test name" error={err("name")} className="sm:col-span-2">
            <Input name="name" defaultValue={test?.name} placeholder="e.g. Series Test 1" maxLength={120} required />
          </Field>
          <Field label="Subject code" error={err("subjectCode")}>
            <Input name="subjectCode" defaultValue={test?.subjectCode} placeholder="e.g. CST301" maxLength={20} required />
          </Field>
          <Field label="Subject name" error={err("subjectName")}>
            <Input name="subjectName" defaultValue={test?.subjectName} placeholder="e.g. Data Structures" maxLength={120} required />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Class</CardTitle>
          <CardDescription>All active students in this department, semester and batch will be assigned the test.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Department" error={err("department")}>
            <select
              name="department"
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setSemester("");
                setBatch("");
              }}
              className={selectClass}
              required
            >
              <option value="">Select…</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Semester" error={err("semester")}>
            <select
              name="semester"
              value={semester}
              onChange={(e) => {
                setSemester(e.target.value);
                setBatch("");
              }}
              className={selectClass}
              disabled={!department}
              required
            >
              <option value="">Select…</option>
              {semesters.map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Batch" error={err("batch")}>
            <select name="batch" value={batch} onChange={(e) => setBatch(e.target.value)} className={selectClass} disabled={!semester} required>
              <option value="">Select…</option>
              {batches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-sm text-muted-foreground sm:col-span-3">
            {studentCount !== undefined
              ? `${studentCount} student${studentCount === 1 ? "" : "s"} will be assigned.`
              : classes.length === 0
                ? "No active students have been imported yet — ask the administrator to import the student list."
                : "Choose department, semester and batch."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
          <CardDescription>Times are in IST. Students can start any time inside the window and get the duration from when they press Start.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Start" error={err("startsAt")}>
            <Input name="startsAt" type="datetime-local" defaultValue={toDateTimeLocalValue(test?.startsAt)} required />
          </Field>
          <Field label="End" error={err("endsAt")}>
            <Input name="endsAt" type="datetime-local" defaultValue={toDateTimeLocalValue(test?.endsAt)} required />
          </Field>
          <Field label="Duration (minutes)" error={err("durationMinutes")}>
            <Input name="durationMinutes" type="number" min={5} max={600} defaultValue={test?.durationMinutes ?? 30} required />
          </Field>
          <div className="space-y-2 sm:col-span-3">
            <Label>Show correct answers</Label>
            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:gap-6">
              <label className="flex items-center gap-2">
                <input type="radio" name="showAnswers" value="AFTER_END" defaultChecked={(test?.showAnswers ?? "AFTER_END") === "AFTER_END"} />
                After the test window closes (recommended)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="showAnswers" value="IMMEDIATELY" defaultChecked={test?.showAnswers === "IMMEDIATELY"} />
                Immediately after each student submits
              </label>
            </div>
          </div>
          <Field label="Instructions to students (optional)" error={err("instructions")} className="sm:col-span-3">
            <Textarea name="instructions" defaultValue={test?.instructions ?? ""} rows={3} maxLength={2000} placeholder="Anything students should know before they start." />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Questions</CardTitle>
          <CardDescription>
            {test
              ? `This test currently has ${test.questionCount} questions. Upload a new file only if you want to replace them all.`
              : "Upload the question file, check it, and review the questions before creating the test."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="questionFile">Question file (.xlsx)</Label>
              <Input id="questionFile" type="file" accept=".xlsx" className="w-80" />
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={checking}
              onClick={() => checkFile(document.getElementById("questionFile") as HTMLInputElement | null)}
            >
              {checking ? "Checking…" : "Check file"}
            </Button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download from a route handler */}
            <a href="/api/templates/questions" className={buttonVariants({ variant: "outline" })}>
              <Download className="size-4" /> Template
            </a>
          </div>
          {(fileError || err("questionFile")) && <p className="text-sm text-destructive">{fileError ?? err("questionFile")}</p>}

          {preview && preview.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTitle>
                {preview.errors.length} problem{preview.errors.length === 1 ? "" : "s"} in {preview.fileName}
              </AlertTitle>
              <AlertDescription>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {preview.errors.slice(0, 30).map((e, i) => (
                    <li key={i}>
                      Row {e.row}, {e.column}: {e.message}
                    </li>
                  ))}
                  {preview.errors.length > 30 && <li>… and {preview.errors.length - 30} more</li>}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {previewOk && (
            <div className="space-y-3">
              <Alert>
                <AlertTitle>
                  {preview.questions.length} question{preview.questions.length === 1 ? "" : "s"} ready from {preview.fileName}
                </AlertTitle>
                <AlertDescription>Correct answers are highlighted. Go back to the file if anything looks wrong.</AlertDescription>
              </Alert>
              <QuestionPreviewTable questions={preview.questions} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || (!test && !previewOk)}>
          {pending ? "Saving…" : test ? "Save changes" : "Create test"}
        </Button>
        <Link href={test ? `/tests/${test.id}` : "/tests"} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function QuestionPreviewTable({ questions }: { questions: QuestionPreviewData["questions"] }) {
  return (
    <div className="max-h-[32rem] overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Question</TableHead>
            <TableHead>Options</TableHead>
            <TableHead className="w-48">Hint / Explanation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {questions.map((q) => (
            <TableRow key={q.number}>
              <TableCell className="align-top font-medium">{q.number}</TableCell>
              <TableCell className="whitespace-pre-wrap align-top">{q.text}</TableCell>
              <TableCell className="align-top">
                <ul className="space-y-0.5">
                  {q.options.map((o) => (
                    <li key={o.label} className={cn("flex gap-2", o.label === q.answer && "font-semibold text-green-700")}>
                      <span className="w-4 shrink-0">{o.label}.</span>
                      <span className="whitespace-pre-wrap">{o.text}</span>
                    </li>
                  ))}
                </ul>
              </TableCell>
              <TableCell className="align-top text-xs text-muted-foreground">
                {q.hint && (
                  <p>
                    <span className="font-medium">Hint:</span> {q.hint}
                  </p>
                )}
                {q.explanation && (
                  <p className="mt-1">
                    <span className="font-medium">Why:</span> {q.explanation}
                  </p>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Field({ label, error, className, children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
