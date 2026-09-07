"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { forgotPasswordAction, type FormState } from "../actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(forgotPasswordAction, {});

  if (state.ok) {
    return (
      <Alert>
        <AlertDescription>
          If an account exists for that ID or email, a reset link has been sent. The link is valid for 30 minutes.
          If you do not receive it, ask the administrator to reset your password.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="idOrEmail">ID or email</Label>
        <Input id="idOrEmail" name="idOrEmail" autoComplete="username" required autoFocus />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
