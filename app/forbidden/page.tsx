import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">You don&apos;t have access to this page</h1>
      <p className="max-w-md text-muted-foreground">
        This page is not available for your role. If you think this is a mistake, contact the administrator.
      </p>
      <Link href="/dashboard" className={buttonVariants()}>
        Go to my dashboard
      </Link>
    </main>
  );
}
