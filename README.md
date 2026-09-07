# JECC Tools — College Tools Platform

Internal web application for Jyothi Engineering College. The first module is the
**Online Test Tool**: faculty create MCQ tests from an Excel file, students take them
inside a timed window, and everyone gets results. Later modules (accreditation documents,
reminders) plug into the same app, users and login.

The stack and conventions are defined in [`../STACK.md`](../STACK.md); the requirements
and design in `../Online-Test-Tool-SRS-v0.2.docx`.

## What is implemented (v1)

| Area | Status |
|---|---|
| Login: staff/student ID + password, Google sign-in (college domain, existing users only) | ✅ |
| Password stays as set by the admin until the user changes it (profile menu); forgot-password email; admin reset; deactivation | ✅ |
| Admin: Excel import of faculty/students (preview → commit), single-user form, import history | ✅ |
| Faculty: create/edit/delete a test from an Excel question file, class assignment, window + duration | ✅ |
| Faculty: extend end time, close early, re-sync students, results tab (live), per-student view, reset attempt | ✅ |
| Faculty/Admin: two-sheet Excel results export | ✅ |
| Student: dashboard, instructions, timed test (shuffled questions/options, auto-save, hints, resume), submit, result/review | ✅ |
| Correct answers shown after the window closes (default) or immediately (per test) | ✅ |
| Cron safety net that finalises expired attempts | ✅ (`vercel.json`, daily at 08:00 IST — the Hobby plan allows one run per day; change to `*/5 * * * *` on Vercel Pro) |
| Archiving uploaded files to Cloudflare R2 | ⏳ not wired yet (`TODO(R2)` markers) |
| Google sign-in | code complete, needs the college's OAuth client to be tested |

## Local development

```bash
pnpm install
cp .env.example .env.local        # then edit — see comments in the file
pnpm db:seed                      # creates the first admin (from INITIAL_ADMIN_EMAIL) — run BEFORE pnpm dev
pnpm dev                          # http://localhost:3000
```

By default `.env.example` points `DATABASE_URL` at an **embedded Postgres (PGlite)** in
`./.pglite`, so nothing else needs to be installed. Migrations are applied automatically
when the dev server starts (`instrumentation.ts`). Only one process may open that folder
at a time — stop `pnpm dev` before running `pnpm db:migrate` or `pnpm db:seed`.

Demo data for trying things out (run with the dev server stopped):

```bash
pnpm dev:demo                     # loads 3 faculty + 60 students straight into the DB
pnpm tsx scripts/dev-samples.ts   # writes ./samples/*.xlsx to try the import wizard and test creation
```

Demo logins after `pnpm db:seed` + `pnpm dev:demo`:
`ADMIN` / `Admin@2026` (or whatever `INITIAL_ADMIN_PASSWORD` is), faculty `JEC1001` / `Faculty@1001`,
student `JEC22CS001` / `Student@1001`.

### Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | TypeScript, ESLint, Vitest (unit tests for parsing, scoring, shuffling, export) |
| `pnpm db:generate` | Create a migration from `lib/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations (PostgreSQL; PGlite auto-migrates on `dev`) |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm db:seed` | Seed the first admin account |

## Production setup (Vercel + Supabase)

1. **Supabase** — create a project (Mumbai region). Copy the *Transaction pooler* connection
   string (port 6543) into `DATABASE_URL`. Run `pnpm db:migrate` against it (from your
   machine or a deploy step) to create the tables.
2. **Google OAuth** — Google Cloud Console → OAuth 2.0 Client ID (Web application).
   Redirect URI: `https://tools.jecc.ac.in/api/auth/callback/google`. Set the consent screen
   to *Internal* (requires Google Workspace on `jecc.ac.in`). Fill `AUTH_GOOGLE_ID` /
   `AUTH_GOOGLE_SECRET`. Without these variables the Google button is simply hidden.
3. **Resend** — API key + a verified sender domain for `EMAIL_FROM` (needed for
   self-service password reset; admins can always reset passwords without it).
4. **Vercel** — import the repo, set every variable from `.env.example`, generate
   `AUTH_SECRET` and `CRON_SECRET`. `vercel.json` schedules `/api/cron/finalize-attempts`
   once a day (08:00 IST) — the most the Hobby plan allows; attempts are also finalised
   whenever anyone opens the test, so this is only a safety net. Point `tools.jecc.ac.in`
   at the deployment.
5. Seed the first admin once: `INITIAL_ADMIN_EMAIL=… DATABASE_URL=… pnpm db:seed`.

Operational rule: **do not deploy during a scheduled test window** (Admin → All tests shows
upcoming windows).

## Project layout

```
app/(auth)/            login, forgot/reset password, forced change-password
app/(app)/admin/       users, import wizard, import history, all tests (read-only)
app/(app)/tests/       faculty: my tests, create/edit, overview/questions/results, attempt view
app/(app)/my-tests/    student: dashboard, instructions, test runner, result/review
app/api/               auth, templates, exports, cron
components/            UI (shadcn/ui, base-ui), feature components
lib/auth*.ts           Auth.js configuration (Google + Credentials, JWT with revocation)
lib/db/                Drizzle schema + connection (Postgres or PGlite)
lib/excel/             Excel parsing, templates, exports
lib/tests/             status/deadline rules, shuffling, scoring, attempts, queries
drizzle/               SQL migrations
scripts/               seed, sample data
```

## Security notes

- Every server action and page re-checks the session and role on the server (`lib/permissions.ts`).
- The test-taking page never receives correct answers or explanations; they are sent only
  after submission and (by default) after the test window closes.
- Deadlines are enforced with the server clock; the browser only displays a countdown.
- Deactivating a user, resetting a password or changing a role bumps `users.sessionVersion`,
  which logs that user out everywhere within a minute.
