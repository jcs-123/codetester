import { notFound, redirect } from "next/navigation";

import { TestRunner } from "@/components/student/test-runner";
import { requireRole } from "@/lib/permissions";
import { getRunnerPayload, getStudentTest } from "@/lib/tests/student-queries";

import { finalizeIfExpired } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("STUDENT");
  const { id } = await params;
  const row = await getStudentTest(id, user.id);
  if (!row) notFound();
  const { test, attempt } = row;

  if (!attempt) redirect(`/my-tests/${id}`);
  const finalized = await finalizeIfExpired(attempt, test);
  if (attempt.submittedAt || finalized) redirect(`/my-tests/${id}/result`);

  const payload = await getRunnerPayload(attempt, test);
  return <TestRunner payload={payload} />;
}
