"use client";

import {
  ChevronDown,
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  KeyRound,
  LogOut,
  Menu,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useState } from "react";

import { logoutAction } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { UserRole } from "@/lib/db/schema";
import type { SessionUser } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: Record<UserRole, NavItem[]> = {
  ADMIN: [
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/imports", label: "Imports", icon: FileSpreadsheet },
    { href: "/admin/tests", label: "All tests", icon: ClipboardList },
  ],
  FACULTY: [{ href: "/tests", label: "My tests", icon: ClipboardList }],
  STUDENT: [{ href: "/my-tests", label: "My tests", icon: GraduationCap }],
};

const ROLE_LABEL: Record<UserRole, string> = { ADMIN: "Admin", FACULTY: "Faculty", STUDENT: "Student" };

export function AppShell({
  user,
  appName,
  children,
}: {
  user: SessionUser;
  appName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV[user.role];

  const renderNav = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-1 p-2">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 flex-col border-r bg-card md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <GraduationCap className="size-5 text-primary" />
          <span className="font-semibold">{appName}</span>
        </div>
        {renderNav()}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b bg-card px-3 md:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" />}>
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="border-b px-4 py-3">
                <SheetTitle className="flex items-center gap-2">
                  <GraduationCap className="size-5 text-primary" />
                  {appName}
                </SheetTitle>
              </SheetHeader>
              {renderNav(() => setOpen(false))}
            </SheetContent>
          </Sheet>

          <span className="font-semibold md:hidden">{appName}</span>
          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2" />}>
              <span className="hidden max-w-40 truncate sm:inline">{user.name}</span>
              <Badge variant="secondary">{ROLE_LABEL[user.role]}</Badge>
              <ChevronDown className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* base-ui requires a label to live inside a group */}
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <div className="truncate font-medium">{user.name}</div>
                  <div className="truncate text-xs font-normal text-muted-foreground">
                    {user.loginId} · {user.email}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/change-password" />}>
                  <KeyRound className="size-4" />
                  Change password
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => startTransition(() => logoutAction())}>
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
