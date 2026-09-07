import { UserForm } from "@/components/admin/user-form";
import { PageHeader } from "@/components/page-header";
import type { UserRole } from "@/lib/db/schema";

export default async function NewUserPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const r = Array.isArray(sp.role) ? sp.role[0] : sp.role;
  const defaultRole: UserRole = r === "FACULTY" || r === "ADMIN" ? r : "STUDENT";
  return (
    <>
      <PageHeader title="Add user" description="Create a single account. For many users, use Import." />
      <UserForm defaultRole={defaultRole} />
    </>
  );
}
