import { PageHeader } from "@/components/page-header";
import { TestForm } from "@/components/tests/test-form";
import { requireRole } from "@/lib/permissions";
import { listClasses } from "@/lib/tests/queries";

export const maxDuration = 60;

export default async function NewTestPage() {
  await requireRole("FACULTY");
  const classes = await listClasses();
  return (
    <>
      <PageHeader title="Create test" description="Fill in the details, upload the question file, check it, and create the test." />
      <TestForm classes={classes} />
    </>
  );
}
