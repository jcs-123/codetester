import { redirect } from "next/navigation";

import { dashboardPath, requireUser } from "@/lib/permissions";

/** FR-AUTH-05: land on the dashboard for the user's role. */
export default async function DashboardPage() {
  const user = await requireUser();
  redirect(dashboardPath(user.role));
}
