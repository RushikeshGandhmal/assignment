# Salary Management

A salary management tool for an HR manager of a 10,000-employee
organization. Add, view, update, and delete employees through a UI;
view salary insights by country and by job title.

## Stack

- **Backend**: Node.js + TypeScript + Express + SQLite (Drizzle ORM)
- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui
- **Validation**: Zod (shared between API and UI via `packages/shared`)
- **Tests**: Vitest + Supertest (API) + React Testing Library (UI)
- **Package manager**: pnpm 10 (workspaces)

## Layout

```
apps/
  api/        Express API
  web/        Next.js UI
packages/
  shared/     Zod schemas + types shared between API and UI
docs/
  planning.md      How I framed and scoped the work
  architecture.md  Repo layout, stack, data model, trade-offs
  performance.md   Seed perf, query perf, indexing decisions
```

## Quickstart

### 1. Install

```bash
pnpm install
```

The root `postinstall` builds `packages/shared` so the apps can
consume it.

### 2. Configure the API

```bash
cat > apps/api/.env <<'EOF'
PORT=4000
DATABASE_FILE=./data/salary-management.db
JWT_SECRET=local-dev-secret-change-me
NODE_ENV=development
EOF
```

### 3. Create the database and seed it

```bash
pnpm --filter @salary-management/api db:migrate
pnpm --filter @salary-management/api seed
```

The seed populates 10,000 employees, 1 HR admin user, and 9 currency
rates in roughly 340 ms.

### 4. Run both apps

```bash
pnpm dev
```

- API → http://localhost:4000
- UI → http://localhost:3000

### 5. Log in

- Email: `hr@example.com`
- Password: `changeme123`

## Tests

```bash
pnpm test           # all packages
pnpm typecheck      # all packages
pnpm lint           # all packages
pnpm build          # all packages
```

The current suite is ~140 tests across the three packages. CI runs
the same pipeline on every push and PR (see
`.github/workflows/ci.yml`).

## API endpoints

```
GET    /health                                liveness check
POST   /auth/login                            sets httpOnly auth cookie
POST   /auth/logout                           clears auth cookie
GET    /auth/me                               current user (requires cookie)

POST   /employees                             create
GET    /employees?page=&pageSize=&...         paginated list with filters
GET    /employees/:id                         fetch one
PATCH  /employees/:id                         partial update
DELETE /employees/:id                         soft delete (status -> INACTIVE)

GET    /insights/summary                      total headcount, total payroll
                                              USD, headcount by country
GET    /insights/countries/:country           min/max/avg/median + per
                                              job-title breakdown
```

All `/employees/*` and `/insights/*` routes require an authenticated
session (cookie).

## Documentation

- `docs/planning.md` — scope decisions, phase breakdown, TDD approach.
- `docs/architecture.md` — repo layout, stack, data model, trade-offs.
- `docs/performance.md` — measured perf, indexing strategy, what we
  deliberately did not optimize.

## Commit history

The git history is structured intentionally. For most backend
features there are two commits per feature: a `test:` commit (RED,
failing tests) followed by a `feat:` commit (GREEN, implementation).
Checking out the test commit, running `pnpm test`, and watching it
fail is the clearest demonstration of the TDD loop. Frontend work
collapses RED + GREEN into a single commit per surface to keep the
log readable.
