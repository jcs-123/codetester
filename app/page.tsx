import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { env } from "@/lib/env";
import { dashboardPath, getSessionUser } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect(dashboardPath(user.role));

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/40 p-6 text-center">
      <GraduationCap className="size-12 text-primary" />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{env.APP_NAME}</h1>
        <p className="mt-2 text-muted-foreground">Jyothi Engineering College — internal tools for faculty and students.</p>
      </div>
      <Link href="/login" className={buttonVariants({ size: "lg" })}>
        Sign in
      </Link>
    </main>
  );
}
