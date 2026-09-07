"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { resetPasswordAction, type FormState } from "../../actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPasswordAction, {});

  if (state.ok) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>Your password has been changed.</AlertDescription>
        </Alert>
        <Link href="/login?reset=1" className={buttonVariants({ className: "w-full" })}>
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {state.error}{" "}
            <Link href="/forgot-password" className="underline">
              Request a new link
            </Link>
          </AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required autoFocus />
        {state.fields?.password && <p className="text-sm text-destructive">{state.fields.password}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        {state.fields?.confirm && <p className="text-sm text-destructive">{state.fields.confirm}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
