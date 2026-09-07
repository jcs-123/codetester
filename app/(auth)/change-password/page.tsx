import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/permissions";

import { ChangePasswordForm } from "./change-password-form";

/** FR-AUTH-12: optional, from the profile menu. Never shown automatically. */
export default async function ChangePasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>
          {user.name} ({user.loginId}) — at least 8 characters, with at least one letter and one digit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ChangePasswordForm />
        <div className="text-center text-sm">
          <Link href="/dashboard" className="text-muted-foreground underline-offset-4 hover:underline">
            Back to my dashboard
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
