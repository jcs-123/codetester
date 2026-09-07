"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function TestTabs({ testId }: { testId: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/tests/${testId}`, label: "Overview", exact: true },
    { href: `/tests/${testId}/questions`, label: "Questions" },
    { href: `/tests/${testId}/results`, label: "Results" },
  ];
  return (
    <div className="flex gap-1 border-b">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium",
              active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
