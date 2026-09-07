import { requireRole } from "@/lib/permissions";

export default async function MyTestsLayout({ children }: { children: React.ReactNode }) {
  await requireRole("STUDENT");
  return <>{children}</>;
}
