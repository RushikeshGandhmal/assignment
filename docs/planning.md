# Planning & Design Notes

Hi! This doc walks you through how I approached the assessment — how I
read the brief, the decisions I made before writing any code, and the
shape of the work that followed. The other two docs (`architecture.md`
and `performance.md`) go deeper into the "how"; this one is the "why".

## How I read the brief

The brief asks for a salary management tool for an HR Manager of a
10,000-employee organization. Before deciding on a stack or writing a
schema, I tried to picture the person actually using it. An HR Manager
at that scale is dealing with:

- Spreadsheets that have become unmanageable.
- Leadership asking ad-hoc questions ("what's the average engineer
  salary in India?") that take too long to answer.
- Outliers and pay-band issues that are hard to spot manually.
- Just finding a specific person in a 10,000-row list.

That framing gave me the two product capabilities to focus on:

1. **Employee CRUD via the UI** — add, view, update, delete.
2. **Salary insights via the UI** — the metrics from the brief, plus a
   few cheap-to-add metrics that make the dashboard feel useful.

Everything else I treated as out of scope on purpose, and I've listed
those below so the cuts are visible.

## How I broke down the work

I planned the project as 11 phases (A through K) before writing the
first line of code. The intent was to make every commit small, focused,
and reviewable — and to keep the order of decisions visible in `git
log`.

| Phase | Topic                                               |
| ----- | --------------------------------------------------- |
| A     | Project foundation (monorepo, scaffolds, CI)        |
| B     | Database schemas (employees, users, currency_rates) |
| C     | Performant seed script (10K employees)              |
| D     | Auth (bcrypt + JWT in httpOnly cookie + middleware) |
| E     | Employee CRUD API                                   |
| F     | Insights API                                        |
| G     | Frontend foundation (API client, login, app shell)  |
| H     | Employee management UI                              |
| I     | Insights dashboard UI                               |
| J     | Polish & docs (this file)                           |
| K     | Deployment                                          |

For the backend phases (B–F) I followed strict TDD: every behavior
change is two commits — a `test:` commit with a failing test, then a
`feat:` commit with the implementation. If you'd like to see this in
practice, check out any `test:` commit, run `pnpm test`, and watch it
fail. Move to the next `feat:` commit and watch it pass.

For the frontend phases (G–I) I relaxed that slightly and shipped tests
alongside implementation in one commit per feature. The unit under
test there is a rendered component, not a network contract that other
parts of the system depend on — so the cost/benefit of two commits per
feature drops. The test coverage is still in place.

## What I deliberately decided to include

The brief requires name, job title, country, and salary. I extended the
employee record with a few more fields because every real HR system
needs them and they unlock the metrics on the dashboard:

- **firstName + lastName** instead of one `fullName` field — makes
  sorting and rendering initials trivial.
- **email** with a unique constraint — every HR system has this, and
  it gives us a natural duplicate-detection story.
- **department** — a second grouping dimension alongside country and
  job title.
- **salary stored as an integer in minor units** (cents, paise, etc.)
  — no floating-point drift anywhere in the codebase. The UI converts
  to/from major units at the form layer.
- **currency** (ISO-4217) — a 10K-employee global org isn't in one
  currency. The seed uses nine.
- **employmentType** (full-time, part-time, contract, intern) — lets
  insights compare apples-to-apples when needed.
- **hireDate** — tenure context.
- **status** (ACTIVE / INACTIVE) — DELETE becomes a soft delete.
- **createdAt / updatedAt** — basic audit timestamps.

For the dashboard I went slightly beyond the explicit requirements:

- **Total headcount** (org-wide and by country).
- **Total payroll**, normalized to USD via a `currency_rates` table.
- **Per-country min / max / avg / median** salary.
- **Per-job-title min / max / avg / median within a country** — the
  brief's explicit requirement, plus median.

Median is the one I want to call out. "Average salary" is misleading on
salary data because a few executives skew it heavily. Median is the
honest version of the same number. Adding it cost almost nothing — the
API does one sorted scan of the per-country rows — and the dashboard
feels noticeably more credible with it included.

## What I deliberately left out of scope

I wrote these down up front so I wouldn't accidentally drift into them:

- Multi-tenancy / multi-organization support.
- Multiple user roles (everyone is "HR Admin").
- Audit log / change history.
- File uploads (photos, contracts).
- Bulk CSV import or export.
- Email notifications.
- Org hierarchy / reporting chain (no manager → reports tree).
- Custom fields per organization.
- Localization / i18n.
- Mobile-specific UI.
- Per-employee currency conversion inside the country drilldown — the
  country page stays in the country's native currency. Converting
  thousands of native-currency salaries to USD destroys precision on
  the median, and the drilldown loses meaning when "average salary in
  India" is displayed in dollars.

Each of these is a perfectly reasonable next iteration, just not for
this assessment.

## How TDD shows up in the commit history

For backend features, the pattern is two commits per change:

```
test(api): add failing tests for POST /employees      ← RED
feat(api): implement POST /employees                  ← GREEN
```

The RED commit fails for a meaningful reason — usually a 404 ("route
doesn't exist") or a module-not-found at import time. The GREEN commit
only touches production code, never the tests it just made pass. That
makes the discipline visible in `git log` and replayable locally.

Project-setup commits (A1–A5) and the seed setup (C1) don't follow
RED→GREEN — there's no test you can write for "the monorepo workspace
config exists". Those are honest one-commit changes.

## How I used AI

I used an AI assistant as a pair programmer throughout. The collaboration
looked like this:

- **The decisions were mine.** Stack choice, scope cuts, data model
  shape, auth strategy, what to leave out, when to commit, what the
  commit messages say. I framed each decision as a conversation,
  pushed back when the AI suggested something I disagreed with, and
  named the trade-off explicitly when I made one.
- **The AI accelerated execution.** Drafting test fixtures, writing
  boilerplate route handlers, generating shadcn primitives, suggesting
  idiomatic refactors, catching typos. I reviewed every change before
  it landed.
- **Verification was non-negotiable.** Every change — AI-suggested or
  not — went through `pnpm format:check`, `pnpm typecheck`, `pnpm
lint`, `pnpm test`, and `pnpm build` before I committed. CI runs
  the same five steps on every push. If something was wrong, that
  pipeline caught it before the commit landed.
- **One concrete example of the AI being wrong, and being caught:**
  during local testing the UI showed a generic "Could not reach the
  server" error. The AI's first instinct was to look at the fetch
  client. The real cause was that the API had no CORS configuration
  — every browser request was being silently blocked by same-origin
  policy. We diagnosed it by simulating the browser's preflight with
  `curl -H "Origin: ..."`, added the `cors` middleware, and shipped
  a regression test that pins the allow-headers in place. The fix is
  the `fix(api): enable CORS so the browser UI can call the API`
  commit.

In short: the AI was a fast pair, and the engineering judgment on what
to keep, what to throw away, and what to defend was mine.

## What I would do next

If I had another half-day, the order would be:

1. **Live currency rates.** The `currency_rates` table is static today;
   a daily cron pulling from an open FX API would be ~30 lines.
2. **Bulk CSV import.** HR teams live in spreadsheets. A CSV import
   endpoint that re-uses the existing Zod schema would unlock a lot.
3. **Audit log.** Every CRUD action writes a row to an `audit_events`
   table. Useful both for compliance and as a recent-activity feed on
   the dashboard.
4. **Server-side render the dashboard.** The dashboard currently fetches
   on mount; turning it into a Next.js server component would give an
   instant first paint with no loading skeleton.

None of those are needed for this assessment, but they're the next
moves I'd make.
