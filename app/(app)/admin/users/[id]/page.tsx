import { notFound } from "next/navigation";

import { AccountActions } from "@/components/admin/account-actions";
import { UserForm } from "@/components/admin/user-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/permissions";
import { formatDateTime } from "@/lib/time";
import { findUserById } from "@/lib/users";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRole("ADMIN");
  const { id } = await params;
  const user = await findUserById(id);
  if (!user) notFound();

  return (
    <>
      <PageHeader
        title={user.name}
        description={`${user.loginId} · ${user.email} · created ${formatDateTime(user.createdAt)} · last login ${formatDateTime(user.lastLoginAt)}`}
        actions={
          user.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="destructive">Inactive</Badge>
        }
      />
      <div className="space-y-8">
        <UserForm user={user} defaultRole={user.role} />
        <AccountActions userId={user.id} isActive={user.isActive} isSelf={user.id === actor.id} />
      </div>
    </>
  );
}
