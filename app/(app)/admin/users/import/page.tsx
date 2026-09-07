import { ImportWizard } from "@/components/admin/import-wizard";
import { PageHeader } from "@/components/page-header";

// Bulk password hashing on commit can take a while for large files.
export const maxDuration = 120;

export default function ImportUsersPage() {
  return (
    <>
      <PageHeader
        title="Import users"
        description="Upload an Excel file to create or update faculty or student accounts. Nothing is saved until you confirm the preview."
      />
      <ImportWizard />
    </>
  );
}
