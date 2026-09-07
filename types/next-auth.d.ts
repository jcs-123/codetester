import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/lib/db/schema";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      loginId: string;
      name: string;
      email: string;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
    loginId?: string;
    mustChangePassword?: boolean;
    sessionVersion?: number;
  }
}
