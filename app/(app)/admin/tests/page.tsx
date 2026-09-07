import { PageHeader } from "@/components/page-header";
import { TestList } from "@/components/tests/test-list";
import { listTests } from "@/lib/tests/queries";

export default async function AdminTestsPage() {
  const rows = await listTests();
  return (
    <>
      <PageHeader title="All tests" description="Every test created by faculty. Open a test to see its questions and results (read-only)." />
      <TestList rows={rows} showCreator emptyMessage="No tests have been created yet." />
    </>
  );
}
