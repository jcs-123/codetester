import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { Plus, Upload } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [studentCountResult, facultyCountResult, adminCountResult] = await Promise.all([
    db.select({ count: count() }).from(users).where(and(eq(users.role, "STUDENT"), isNull(users.deletedAt))),
    db.select({ count: count() }).from(users).where(and(eq(users.role, "FACULTY"), isNull(users.deletedAt))),
    db.select({ count: count() }).from(users).where(and(eq(users.role, "ADMIN"), isNull(users.deletedAt))),
  ]);
  const studentTotal = Number(studentCountResult[0]?.count ?? 0);
  const facultyTotal = Number((facultyCountResult[0]?.count ?? 0) + (adminCountResult[0]?.count ?? 0));
  const allTotal = studentTotal + facultyTotal;

  // If no tab is chosen, pick "all" if there are users, otherwise "students"
  const rawTab = str(sp.tab);
  const tab: "all" | "faculty" | "students" =
    rawTab === "faculty" ? "faculty" : rawTab === "students" ? "students" : "all";

  const roles =
    tab === "faculty"
      ? (["FACULTY", "ADMIN"] as const)
      : tab === "students"
        ? (["STUDENT"] as const)
        : (["FACULTY", "ADMIN", "STUDENT"] as const);

  const q = str(sp.q).trim();
  const department = str(sp.department);
  const semester = str(sp.semester);
  const batch = str(sp.batch);
  const designation = str(sp.designation);
  const active = str(sp.active); // "", "1", "0"
  const page = Math.max(1, Number(str(sp.page)) || 1);

  const conditions: (SQL | undefined)[] = [inArray(users.role, [...roles]), isNull(users.deletedAt)];
  if (q) conditions.push(or(ilike(users.loginId, `%${q}%`), ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`)));
  if (department) conditions.push(sql`lower(${users.department}) = ${department.toLowerCase()}`);
  if (semester) conditions.push(eq(users.semester, Number(semester)));
  if (batch) conditions.push(sql`lower(${users.batch}) = ${batch.toLowerCase()}`);
  if (designation) conditions.push(sql`lower(${users.designation}) = ${designation.toLowerCase()}`);
  if (active === "1") conditions.push(eq(users.isActive, true));
  if (active === "0") conditions.push(eq(users.isActive, false));
  const where = and(...conditions);

  const [rows, [{ total }], departments, batches, designations] = await Promise.all([
    db
      .select()
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt), desc(users.isActive), asc(users.department), asc(users.loginId))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(users).where(where),
    db
      .selectDistinct({ v: users.department })
      .from(users)
      .where(and(inArray(users.role, [...roles]), isNull(users.deletedAt)))
      .orderBy(asc(users.department)),
    tab === "students" || tab === "all"
      ? db
          .selectDistinct({ v: users.batch })
          .from(users)
          .where(and(eq(users.role, "STUDENT"), isNull(users.deletedAt)))
          .orderBy(asc(users.batch))
      : Promise.resolve([] as { v: string | null }[]),
    tab === "faculty" || tab === "all"
      ? db
          .selectDistinct({ v: users.designation })
          .from(users)
          .where(and(inArray(users.role, ["FACULTY", "ADMIN"]), isNull(users.deletedAt)))
          .orderBy(asc(users.designation))
      : Promise.resolve([] as { v: string | null }[]),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    Object.entries({ tab, q, department, semester, batch, designation, active, page: String(p) }).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    return `/admin/users?${params.toString()}`;
  };

  const tabsConfig = [
    { key: "all", label: "All Users", count: allTotal },
    { key: "faculty", label: "Faculty & Staff", count: facultyTotal },
    { key: "students", label: "Students", count: studentTotal },
  ] as const;

  return (
    <>
      <PageHeader
        title="Users"
        description="Faculty, staff, and student accounts. Import from Excel or add one at a time."
        actions={
          <>
            <Link href="/admin/users/import" className={buttonVariants({ variant: "outline" })}>
              <Upload className="size-4" /> Import
            </Link>
            <Link href={`/admin/users/new?role=${tab === "students" ? "STUDENT" : "FACULTY"}`} className={buttonVariants()}>
              <Plus className="size-4" /> Add user
            </Link>
          </>
        }
      />

      <div className="mb-4 flex gap-2 border-b">
        {tabsConfig.map((t) => (
          <Link
            key={t.key}
            href={`/admin/users?tab=${t.key}`}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{t.label}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                tab === t.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {t.count}
            </span>
          </Link>
        ))}
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value={tab} />
        <Input name="q" defaultValue={q} placeholder="Search ID, name or email" className="w-64" />
        <NativeSelect name="department" value={department} placeholder="All departments" options={departments.map((d) => d.v)} />
        {tab === "students" && (
          <>
            <NativeSelect
              name="semester"
              value={semester}
              placeholder="All semesters"
              options={["1", "2", "3", "4", "5", "6", "7", "8"]}
              labels={(v) => `Semester ${v}`}
            />
            <NativeSelect name="batch" value={batch} placeholder="All batches" options={batches.map((b) => b.v ?? "")} />
          </>
        )}
        {tab === "faculty" && (
          <NativeSelect name="designation" value={designation} placeholder="All designations" options={designations.map((d) => d.v ?? "")} />
        )}
        <NativeSelect
          name="active"
          value={active}
          placeholder="Active and inactive"
          options={["1", "0"]}
          labels={(v) => (v === "1" ? "Active only" : "Inactive only")}
        />
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {(q || department || semester || batch || designation || active) && (
          <Link href={`/admin/users?tab=${tab}`} className={buttonVariants({ variant: "ghost" })}>
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              {tab === "students" ? (
                <>
                  <TableHead>Sem</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Adm. year</TableHead>
                </>
              ) : tab === "faculty" ? (
                <TableHead>Designation</TableHead>
              ) : (
                <TableHead>Details</TableHead>
              )}
              <TableHead>Status</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                  {total === 0 && !q && !department && !semester && !batch && !designation && !active
                    ? `No users found in ${tab === "all" ? "the system" : tab}. Click "Add user" or "Import" to add accounts.`
                    : "No users match these filters."}
                </TableCell>
              </TableRow>
            )}
            {rows.map((u) => (
              <TableRow key={u.id} className={cn(!u.isActive && "opacity-60")}>
                <TableCell className="font-mono text-xs font-semibold">{u.loginId}</TableCell>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  {u.role === "ADMIN" ? (
                    <Badge variant="default">Admin</Badge>
                  ) : u.role === "FACULTY" ? (
                    <Badge variant="secondary">Faculty</Badge>
                  ) : (
                    <Badge variant="outline">Student</Badge>
                  )}
                </TableCell>
                <TableCell>{u.department}</TableCell>
                {tab === "students" ? (
                  <>
                    <TableCell>{u.semester ?? "—"}</TableCell>
                    <TableCell>{u.batch ?? "—"}</TableCell>
                    <TableCell>{u.admissionYear ?? "—"}</TableCell>
                  </>
                ) : tab === "faculty" ? (
                  <TableCell>{u.designation ?? "—"}</TableCell>
                ) : (
                  <TableCell className="text-xs text-muted-foreground">
                    {u.role === "STUDENT"
                      ? `Sem ${u.semester ?? "—"} · ${u.batch ?? ""}`
                      : (u.designation ?? "—")}
                  </TableCell>
                )}
                <TableCell>
                  {u.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="destructive">Inactive</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                  {formatDateTime(u.createdAt)}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                  {formatDateTime(u.lastLoginAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/admin/users/${u.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    Edit
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} {tab === "all" ? "total user" : tab === "students" ? "student" : "faculty member"}
          {total === 1 ? "" : "s"}
          {pages > 1 && ` · page ${page} of ${pages}`}
        </span>
        {pages > 1 && (
          <div className="flex gap-2">
            <Link
              aria-disabled={page <= 1}
              href={pageHref(Math.max(1, page - 1))}
              className={buttonVariants({ variant: "outline", size: "sm", className: page <= 1 ? "pointer-events-none opacity-50" : "" })}
            >
              Previous
            </Link>
            <Link
              aria-disabled={page >= pages}
              href={pageHref(Math.min(pages, page + 1))}
              className={buttonVariants({ variant: "outline", size: "sm", className: page >= pages ? "pointer-events-none opacity-50" : "" })}
            >
              Next
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

function NativeSelect({
  name,
  value,
  placeholder,
  options,
  labels,
}: {
  name: string;
  value: string;
  placeholder: string;
  options: (string | null)[];
  labels?: (v: string) => string;
}) {
  return (
    <select
      name={name}
      defaultValue={value}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs"
      aria-label={placeholder}
    >
      <option value="">{placeholder}</option>
      {options
        .filter((o): o is string => Boolean(o))
        .map((o) => (
          <option key={o} value={o}>
            {labels ? labels(o) : o}
          </option>
        ))}
    </select>
  );
}
