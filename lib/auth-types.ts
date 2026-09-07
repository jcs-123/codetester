import type { JWT } from "next-auth/jwt";

import type { UserRole } from "@/lib/db/schema";

/**
 * Claims we store in the session JWT. (`next-auth/jwt` re-exports its JWT type
 * from `@auth/core`, which module augmentation cannot reliably reach, so the
 * callbacks cast to this type instead.)
 */
export type AppJWT = JWT & {
  uid?: string;
  role?: UserRole;
  loginId?: string;
  /** users.sessionVersion at the last DB check */
  sv?: number;
  /** mustChangePassword */
  mcp?: boolean;
  /** epoch ms of the last DB re-validation */
  chk?: number;
};
