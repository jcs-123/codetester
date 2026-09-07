"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { resetUserPasswordAction, setUserActiveAction } from "@/app/(app)/admin/users/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function AccountActions({ userId, isActive, isSelf }: { userId: string; isActive: boolean; isSelf: boolean }) {
  const [pending, start] = useTransition();
  const [manual, setManual] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const toggleActive = () => {
    const next = !isActive;
    if (!next && !confirm("Deactivate this user? They will be signed out everywhere and cannot log in until reactivated.")) return;
    start(async () => {
      const res = await setUserActiveAction(userId, next);
      if (res.ok) toast.success(next ? "User reactivated" : "User deactivated");
      else toast.error(res.error.message);
    });
  };

  const reset = () => {
    if (!confirm("Reset this user's password? They will be signed out everywhere and sign in with the new password.")) return;
    start(async () => {
      const res = await resetUserPasswordAction(userId, manual || undefined);
      if (res.ok) {
        setTempPassword(res.data.temporaryPassword);
        setManual("");
        toast.success("Password reset");
      } else toast.error(res.error.message);
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Account status</CardTitle>
          <CardDescription>
            {isActive ? "This account is active." : "This account is inactive — the user cannot sign in."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant={isActive ? "destructive" : "default"} onClick={toggleActive} disabled={pending || isSelf}>
            {isActive ? "Deactivate" : "Reactivate"}
          </Button>
          {isSelf && <p className="mt-2 text-xs text-muted-foreground">You cannot deactivate your own account.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>Leave blank to generate a new password. The user signs in with it until they change it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tempPassword && (
            <Alert>
              <AlertTitle>New password (shown once)</AlertTitle>
              <AlertDescription>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{tempPassword}</code>
              </AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Optional: type the new password"
              autoComplete="off"
            />
            <Button variant="outline" onClick={reset} disabled={pending}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
