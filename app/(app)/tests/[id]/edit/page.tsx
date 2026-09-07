import { notFound, redirect } from "next/navigation";

import { TestForm } from "@/components/tests/test-form";
import { requireRole } from "@/lib/permissions";
import { getTestForUser, listClasses } from "@/lib/tests/queries";
import { testStatus } from "@/lib/tests/status";

export const maxDuration = 60;

export default async function EditTestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("FACULTY");
  const { id } = await params;
  const row = await getTestForUser(id, user);
  if (!row) notFound();
  if (testStatus(row.test) !== "SCHEDULED") redirect(`/tests/${id}`);
  const classes = await listClasses();
  return (
    <div className="mt-2">
      <h2 className="mb-4 text-lg font-semibold">Edit test</h2>
      <TestForm test={row.test} classes={classes} />
    </div>
  );
}
