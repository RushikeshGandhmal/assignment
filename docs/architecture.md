# Architecture

This doc explains how the code is organized and why. It's intentionally
short — if you want the "why I built it this way" story, `planning.md`
has that; if you want the "how fast does it run", `performance.md` has
that.

## Repository layout

One repo, three packages, using pnpm workspaces:

```
salary-management/
├── apps/
│   ├── api/                 Express + TypeScript backend
│   └── web/                 Next.js 16 (App Router) frontend
└── packages/
    └── shared/              Zod schemas + types used by both apps
```

The `shared` package is the single source of truth for any validation
rule that crosses the network. The same Zod schema validates the request
body on the server and the form input on the client, so they can never
drift out of sync.

## Why a monorepo, not two repos

A few reasons:

- You clone one repo, run `pnpm install`, and have the whole thing.
- Shared types and schemas live next to both consumers — no internal
  npm package to publish.
- Atomic changes that touch both API and UI are one commit, not two.
- The deployment topology is still two services (API + Web) — repo
  layout and deployment are independent decisions.

## Tech stack

| Layer       | Choice                                     |
| ----------- | ------------------------------------------ |
| Backend     | Node.js + TypeScript + Express             |
| Database    | SQLite via `better-sqlite3`                |
| ORM         | Drizzle ORM + Drizzle Kit (migrations)     |
| Auth        | bcryptjs + jsonwebtoken in httpOnly cookie |
| Frontend    | Next.js 16 (App Router) + React 19         |
| UI kit      | shadcn/ui on Tailwind v4                   |
| Validation  | Zod (shared between API and UI)            |
| Tests       | Vitest (+ Supertest for API, RTL for UI)   |
| Package mgr | pnpm 10 with workspaces                    |
| CI          | GitHub Actions                             |

### A quick note on each choice

- **Express** — the brief named Node + Express, and the project scope is
  small enough that something heavier like NestJS would be overkill.
- **SQLite** — zero ops for a 10K-row dataset, the synchronous
  `better-sqlite3` driver is the fastest way to seed bulk data, and
  deployment is just shipping a file with the binary.
- **Drizzle** over Prisma — lightweight, SQL-shaped, type-safe, and the
  migrations it generates are plain SQL that you can read directly.
- **shadcn/ui** — we own the component source under
  `apps/web/src/components/ui`. No lock-in, full control over markup
  and styling, no big component-library dependency.
- **Zod in `packages/shared`** — one place to express "what's a valid
  employee", used by both the API's request validation and the UI's
  form validation. `z.infer<typeof schema>` gives us TypeScript types
  for free.

## API structure (`apps/api/src`)

```
app.ts                Express app factory — takes { db, jwtSecret }
                      and returns an Express instance. Pure, no
                      .listen() call. This is what tests mount.
server.ts             Boot script — parses env, calls createApp(),
                      runs `select 1` to verify the DB, then .listen()s.
env.ts                Zod-parsed environment configuration.

auth/
  password.ts         hashPassword / verifyPassword (bcrypt wrapper).
  jwt.ts              signAuthToken / verifyAuthToken.
  middleware.ts       requireAuth: reads cookie, verifies, attaches
                      req.user, 401s otherwise.
  routes.ts           POST /auth/login, POST /auth/logout, GET /auth/me.

employees/
  service.ts          EmployeeService — business logic, DB writes,
                      typed errors (EmployeeEmailConflictError).
  routes.ts           Thin HTTP shell — Zod-validates body/query,
                      maps service errors to status codes.

insights/
  service.ts          InsightsService.getSummary() and
                      .getCountryInsights(country).
  routes.ts           GET /insights/summary and
                      GET /insights/countries/:country.

db/
  client.ts           createDb() factory — opens better-sqlite3 with
                      WAL + foreign_keys + busy_timeout, returns a
                      typed Drizzle instance.
  index.ts            Singleton db built from env config.
  migrate.ts          Runs migrations from drizzle/.
  schema/             Drizzle tables (employees, users, currency_rates).

seed/
  seed.ts             Pure seed function — generates rows in memory,
                      bulk-inserts in a single transaction.
  rng.ts              Mulberry32 seedable PRNG.
  reference-data.ts   Countries, job titles, departments, currencies.
  run.ts              CLI entry: `pnpm seed`.
```

The shape I aimed for: every route handler is a thin HTTP shell over a
service method. The service holds the business logic and DB access; the
route is purely about "parse input → call service → map result to HTTP
status code". This means services can be unit-tested without spinning
up an Express app, and route tests are clean integration tests against
an in-memory SQLite DB.

## Data model

Three tables:

```
employees          id (uuid), first_name, last_name, email (unique),
                   job_title, department, country (ISO-2), salary
                   (integer, minor units), currency (ISO-4217),
                   employment_type, hire_date (ISO date), status
                   (ACTIVE/INACTIVE, default ACTIVE), created_at,
                   updated_at.
                   Indexes: country, job_title, status,
                   (country, job_title).

users              id (uuid), email (unique), password_hash, created_at.

currency_rates     currency (PK), usd_rate (real), updated_at.
```

The indexes weren't chosen randomly — each one backs a specific query:

- `country` — every country drilldown query filters on it.
- `job_title` — search and filter queries use it.
- `status` — every list and aggregate filters `WHERE status='ACTIVE'`.
- `(country, job_title)` — the brief's explicit "avg salary for a job
  title in a country" query. The composite index lets that query stay
  index-only.

The generated SQL migrations live in `apps/api/drizzle/`.

## Auth flow

1. `POST /auth/login` with `{ email, password }`.
2. Server verifies the bcrypt hash, signs a JWT (12-hour TTL) with
   `{ sub: userId, email }`, and sets it as an httpOnly + SameSite=lax
   cookie. The `Secure` flag gets added in production.
3. Subsequent requests automatically carry the cookie. The `requireAuth`
   middleware verifies it and attaches `req.user`.
4. `POST /auth/logout` clears the cookie.
5. `GET /auth/me` returns the current user. The UI calls this on mount
   inside `AuthGuard` to decide between rendering the app and redirecting
   to `/login`.

There's no signup flow. The seed script creates one HR admin user
(`hr@example.com` / `changeme123`). Multi-user / role-based access is
explicitly out of scope.

## Frontend structure (`apps/web/src`)

```
app/
  login/page.tsx              Public login form.
  (app)/                      Route group for protected pages.
    layout.tsx                AuthGuard + AppShell + Toaster.
    page.tsx                  Dashboard (summary + country drilldown).
    employees/page.tsx        Paginated, searchable employee table.

components/
  auth-context.tsx            React context with the current user.
  auth-guard.tsx              Calls /auth/me, redirects on 401.
  app-shell.tsx               Header with nav and logout.
  employees/
    employee-form-dialog.tsx  Create/edit modal.
    delete-employee-dialog.tsx
  ui/                         shadcn primitives we own.

lib/
  api.ts                      Typed fetch wrapper (apiGet/Post/Patch/
                              Delete) that always sends credentials.
  employees.ts                Typed calls into /employees/*.
  insights.ts                 Typed calls into /insights/*.
  countries.ts                formatCountry(code) using Intl.DisplayNames.
```

The `(app)` folder is a Next.js route group. The parentheses mean it
doesn't appear in the URL — it exists only to attach the
`AuthGuard + AppShell + Toaster` layout to every protected page in one
place. The login page sits outside it, so the guard never wraps it.

## Trade-offs I considered

A few decisions where there were real alternatives:

- **Two Zod schemas (create + update) vs one with optionals.** Chose
  two. `createEmployeeSchema` requires every field;
  `updateEmployeeSchema = createEmployeeSchema.partial().refine(...)`
  rejects empty bodies. Two named schemas keep the error messages and
  TypeScript types clear at each call site.
- **PUT vs PATCH for updates.** Chose PATCH because the operation is
  always a partial update. PUT implies whole-resource replacement,
  which we never do.
- **Median in SQL vs in JS.** Chose JS. SQLite has no native median or
  percentile function; the workarounds (`WITH ROW_NUMBER()` tricks) are
  more code, more round trips, and no faster on the bounded per-country
  slices we're querying. Pulling sorted rows once and computing
  min/max/avg/median in a single pass is simpler.
- **Soft vs hard delete.** Chose soft. HR audit trails matter — once
  someone has existed in the system, you can't pretend they didn't.
  DELETE flips `status` to `INACTIVE`; the list endpoint hides them by
  default, but they're still reachable by direct ID lookup.
- **Source-only vs built shared package.** Chose built. The compiled
  `packages/shared/dist` is the surface both apps consume. This was the
  cleanest way to resolve the interop between Turbopack (the Next.js
  bundler, which doesn't understand TypeScript's `.js`-extension
  imports) and NodeNext (the TypeScript module resolution the API uses,
  which requires them). A root `postinstall` hook builds the shared
  package after `pnpm install`, so the dev experience stays "just run
  install".
