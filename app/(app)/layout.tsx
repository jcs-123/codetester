import { AppShell } from "@/components/app-shell";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell user={user} appName={env.APP_NAME}>
      {children}
    </AppShell>
  );
}
