import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { TestList } from "@/components/tests/test-list";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/permissions";
import { listTests } from "@/lib/tests/queries";

export default async function TestsPage() {
  const user = await requireRole("FACULTY", "ADMIN");
  if (user.role === "ADMIN") redirect("/admin/tests");

  const rows = await listTests({ createdById: user.id });
  return (
    <>
      <PageHeader
        title="My tests"
        description="Tests you have created. Students see a test only inside its window."
        actions={
          <Link href="/tests/new" className={buttonVariants()}>
            <Plus className="size-4" /> Create test
          </Link>
        }
      />
      <TestList rows={rows} emptyMessage="No tests yet — create your first test from an Excel question file." />
    </>
  );
}
