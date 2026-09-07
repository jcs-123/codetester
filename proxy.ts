import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth.config";

// Lightweight Auth.js instance: decodes the session JWT only (no DB access).
const { auth } = NextAuth(authConfig);

const PUBLIC_PREFIXES = ["/login", "/forgot-password", "/reset-password", "/api/auth", "/api/cron"];

function isPublic(pathname: string): boolean {
  return pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const user = req.auth?.user;

  if (!user?.id) {
    if (isPublic(pathname)) return NextResponse.next();
    const login = new URL("/login", req.nextUrl);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  // Note: the proxy only decodes the JWT; it does not check the database. A token
  // whose user was deactivated or whose sessionVersion changed still decodes here,
  // so "already signed in → dashboard" is decided by the login page (full auth()),
  // never by the proxy — otherwise a stale token would loop /login ↔ /dashboard.
  return NextResponse.next();
});

export const config = {
  // Everything except static assets.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml)$).*)"],
};
