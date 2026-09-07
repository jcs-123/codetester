"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { saveUserAction, type UserFormState } from "@/app/(app)/admin/users/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { User, UserRole } from "@/lib/db/schema";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "STUDENT", label: "Student" },
  { value: "FACULTY", label: "Faculty" },
  { value: "ADMIN", label: "Admin" },
];

export function UserForm({ user, defaultRole }: { user?: User; defaultRole: UserRole }) {
  const [state, action, pending] = useActionState<UserFormState, FormData>(saveUserAction, {});
  const [role, setRole] = useState<UserRole>(user?.role ?? defaultRole);
  const [passwordMode, setPasswordMode] = useState<"keep" | "generate" | "manual">(user ? "keep" : "generate");
  const isStudent = role === "STUDENT";
  const err = (k: string) => state.fields?.[k];

  if (state.ok && !user) {
    return (
      <Alert>
        <AlertTitle>User created</AlertTitle>
        <AlertDescription className="space-y-3">
          {state.temporaryPassword && (
            <p>
              Password (shown once): <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{state.temporaryPassword}</code>
              <br />
              Share it with the user. They can change it later from their profile menu.
            </p>
          )}
          <div className="flex gap-2">
            <Link href={`/admin/users/${state.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open user
            </Link>
            <Link href="/admin/users/new" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Add another
            </Link>
            <Link href="/admin/users" className={buttonVariants({ size: "sm" })}>
              Back to users
            </Link>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={action} className="max-w-2xl space-y-5" noValidate>
      {user && <input type="hidden" name="id" value={user.id} />}
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.ok && user && (
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          {state.temporaryPassword && (
            <AlertDescription>
              New password (shown once):{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{state.temporaryPassword}</code>
            </AlertDescription>
          )}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role" error={err("role")}>
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={isStudent ? "Student ID" : "Staff ID"} error={err("loginId")}>
          <Input name="loginId" defaultValue={user?.loginId} autoCapitalize="characters" required />
        </Field>
        <Field label="Name" error={err("name")}>
          <Input name="name" defaultValue={user?.name} required />
        </Field>
        <Field label="Email" error={err("email")}>
          <Input name="email" type="email" defaultValue={user?.email} required />
        </Field>
        <Field label="Department" error={err("department")}>
          <Input name="department" defaultValue={user?.department} placeholder="e.g. CSE" required />
        </Field>
        {isStudent ? (
          <>
            <Field label="Semester" error={err("semester")}>
              <Input name="semester" type="number" min={1} max={8} defaultValue={user?.semester ?? ""} required />
            </Field>
            <Field label="Batch (section)" error={err("batch")}>
              <Input name="batch" defaultValue={user?.batch ?? ""} placeholder="e.g. A" required />
            </Field>
            <Field label="Admission year" error={err("admissionYear")}>
              <Input name="admissionYear" type="number" min={2000} max={2099} defaultValue={user?.admissionYear ?? ""} required />
            </Field>
          </>
        ) : (
          <Field label="Designation" error={err("designation")}>
            <Input name="designation" defaultValue={user?.designation ?? ""} placeholder="e.g. Assistant Professor" required />
          </Field>
        )}
      </div>

      <fieldset className="space-y-2 rounded-md border p-4">
        <legend className="px-1 text-sm font-medium">Password</legend>
        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:gap-6">
          {user && (
            <label className="flex items-center gap-2">
              <input type="radio" name="passwordMode" value="keep" checked={passwordMode === "keep"} onChange={() => setPasswordMode("keep")} />
              Keep current password
            </label>
          )}
          <label className="flex items-center gap-2">
            <input type="radio" name="passwordMode" value="generate" checked={passwordMode === "generate"} onChange={() => setPasswordMode("generate")} />
            Generate a password
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="passwordMode" value="manual" checked={passwordMode === "manual"} onChange={() => setPasswordMode("manual")} />
            Set a password
          </label>
        </div>
        {passwordMode === "manual" && (
          <Field label="Password" error={err("password")}>
            <Input name="password" type="text" autoComplete="off" placeholder="Min 8 characters, a letter and a digit" />
          </Field>
        )}
        <p className="text-xs text-muted-foreground">The user signs in with this password until they change it from their profile menu.</p>
      </fieldset>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : user ? "Save changes" : "Create user"}
        </Button>
        <Link href="/admin/users" className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
