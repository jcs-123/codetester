import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import type { UserRole } from "@/lib/db/schema";
import { fail, type ActionFailure } from "@/lib/result";

export type SessionUser = {
  id: string;
  role: UserRole;
  loginId: string;
  name: string;
  email: string;
  mustChangePassword: boolean;
};

export function dashboardPath(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "/admin/users";
    case "FACULTY":
      return "/tests";
    case "STUDENT":
    default:
      return "/my-tests";
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  return session?.user?.id ? (session.user as SessionUser) : null;
}

/** For pages: redirects to /login when not signed in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/forbidden");
  return user;
}

/** For Server Actions: returns a typed error instead of redirecting. */
export async function actionUser(
  ...roles: UserRole[]
): Promise<{ user: SessionUser; error: null } | { user: null; error: ActionFailure }> {
  const user = await getSessionUser();
  if (!user) return { user: null, error: fail("FORBIDDEN", "You must be signed in.") };
  if (roles.length && !roles.includes(user.role))
    return { user: null, error: fail("FORBIDDEN", "You do not have permission to do this.") };
  return { user, error: null };
}
