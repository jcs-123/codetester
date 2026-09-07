import { requireRole } from "@/lib/permissions";

// Faculty own these screens; Admin may open them read-only (FR-ADM-16).
export default async function TestsLayout({ children }: { children: React.ReactNode }) {
  await requireRole("FACULTY", "ADMIN");
  return <>{children}</>;
}
