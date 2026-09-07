import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { googleEnabled } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";

import { googleSignInAction } from "../actions";
import { LoginForm } from "./login-form";

const GOOGLE_ERRORS: Record<string, string> = {
  google_unverified: "Your Google account email is not verified.",
  domain: "Please sign in with your college Google account (@jecc.ac.in).",
  not_found: "Account not found. Please contact the administrator.",
  inactive: "This account is inactive. Please contact the administrator.",
  AccessDenied: "Sign-in was not allowed. Please contact the administrator.",
  Configuration: "Google sign-in is not configured correctly. Please contact the administrator.",
  OAuthCallbackError: "Google sign-in was cancelled or failed. Please try again.",
  OAuthAccountNotLinked: "Account not found. Please contact the administrator.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next);

  // Already signed in (verified against the database, not just a decodable cookie)?
  const session = await auth();
  if (session?.user?.id) redirect(next || "/dashboard");

  // A session cookie that auth() rejected means the session was revoked or expired.
  const jar = await cookies();
  const staleSession = jar.getAll().some((c) => c.name.includes("authjs.session-token"));

  const errorKey = Array.isArray(sp.error) ? sp.error[0] : sp.error;
  const googleError = errorKey ? (GOOGLE_ERRORS[errorKey] ?? "Sign-in failed. Please try again.") : null;
  const justReset = sp.reset === "1";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use your staff or student ID, or your college Google account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {justReset && (
          <Alert>
            <AlertDescription>Your password has been changed. Please sign in.</AlertDescription>
          </Alert>
        )}
        {staleSession && !justReset && (
          <Alert>
            <AlertDescription>Your session has ended. Please sign in again.</AlertDescription>
          </Alert>
        )}
        {googleError && (
          <Alert variant="destructive">
            <AlertDescription>{googleError}</AlertDescription>
          </Alert>
        )}

        <LoginForm next={next} />

        <div className="text-center text-sm">
          <Link href="/forgot-password" className="text-muted-foreground underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>

        {googleEnabled && (
          <>
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>
            <form action={googleSignInAction.bind(null, next)}>
              <Button type="submit" variant="outline" className="w-full">
                <GoogleMark />
                Sign in with Google
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
