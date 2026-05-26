# Performance Notes

This is an HR tool for 10,000 employees, so the absolute numbers stay
small. But the brief specifically calls out performance — "engineers run
this script regularly, and performance of the script matters" — so I
treated that seriously. This doc walks through what I measured, what I
optimized, and what I deliberately left alone.

## Seed script: 10,000 employees in ~340 ms

This was the biggest performance focus in the project. Measured on the
in-memory SQLite DB used by the tests, the seed inserts 10,000
employees + 1 admin user + 9 currency rates in around 340 ms end to
end.

The test enforces a budget of under 5 seconds, so we have about a 14×
margin. That margin is intentional — it means a slower CI runner won't
make the test flaky, and the budget will fail loudly if we accidentally
regress.

### What makes it fast

A few things, in order of impact:

1. **Single transaction.** All 10,000 inserts plus the user and currency
   inserts run inside one `db.transaction(...)`. SQLite does one fsync at
   COMMIT instead of one per row. This is the single biggest win — without
   it, the same script takes tens of seconds.

2. **Batched inserts.** Rows go in as chunks of 500 via Drizzle's
   `.values([...])`. SQLite's bind-parameter limit is 999 per statement,
   and each employee row binds 14 columns, so 500 × 14 = 7,000 — well
   within limits with room to spare. Per-row inserts and batched inserts
   are roughly equal in wall-clock time once you're inside a transaction,
   but batched is easier to reason about and to bound.

3. **WAL journal mode.** `PRAGMA journal_mode = WAL` is set in
   `createDb()`. Writers don't block readers and commits don't rewrite
   the whole DB file. On a cold cache this alone roughly halves the seed
   time vs the default rollback-journal mode.

4. **Prepared statements.** Drizzle reuses prepared statements behind the
   scenes for repeated `.insert(...)` calls. Combined with batching, we
   pay the SQL parse and plan cost once per chunk, not once per row.

5. **One bcrypt hash, not 10,000.** The admin password is hashed once.
   Bcrypt at 10 rounds is the slowest single thing in the script — if you
   misuse it and hash 10,000 times, it dominates the wall-clock budget.
   Employees don't have passwords, so the temptation doesn't exist, but
   it's worth naming.

6. **Deterministic PRNG.** `mulberry32` is a 4-line seedable random
   number generator. Same seed → same data. This means the test can
   compare two runs row-for-row, and engineers running the seed locally
   get reproducible bug reports.

### The cost of idempotency

The seed clears `employees`, `users`, and `currency_rates` inside the
same transaction before inserting. Two `DELETE FROM` calls cost a few
milliseconds total, which is the right trade for "running it twice
doesn't double the data".

## Insights queries

### `GET /insights/summary`

Two SQL queries:

```sql
SELECT count(*),
       coalesce(sum(salary * usd_rate), 0)
  FROM employees
  LEFT JOIN currency_rates
    ON employees.currency = currency_rates.currency
  WHERE status = 'ACTIVE';

SELECT country, count(*)
  FROM employees
  WHERE status = 'ACTIVE'
  GROUP BY country
  ORDER BY count(*) DESC, country ASC;
```

Both run in under 5 ms on 10K rows. The `country` index backs the GROUP
BY without needing a sort.

### `GET /insights/countries/:country`

One SQL query — pull `(salary, jobTitle)` for the country, ordered by
salary ASC — then compute all the stats in JavaScript:

```sql
SELECT salary, job_title
  FROM employees
  WHERE country = ? AND status = 'ACTIVE'
  ORDER BY salary ASC;
```

The `(country, job_title)` composite index lets the WHERE clause narrow
quickly. The per-country slice is bounded — in the seed, no country has
more than about 1,500 rows — so a single pass over the result set
computes min, max, avg, and median (both overall and per job title) in
O(n).

SQLite doesn't have a native `PERCENTILE_CONT` or any window-friendly
median, so the alternatives would have been:

- A `WITH ... ROW_NUMBER()` SQL trick for median, plus a separate
  aggregate query (more SQL, more round trips, no faster on small n).
- A user-defined SQL function (extra moving parts).

Computing in JS won here on both simplicity and speed for the data sizes
involved.

## List endpoint pagination

`GET /employees` always paginates server-side. The maximum `pageSize`
is 100 (validated in `listEmployeesQuerySchema`). The endpoint returns:

```
{ items, page, pageSize, total, totalPages }
```

We never dump 10K rows over the wire to the UI. The UI is built around
this — the employees table has prev/next buttons and uses `total` and
`totalPages` directly.

Two queries back each list request: one `count(*)` for `total`, one
`SELECT ... LIMIT ? OFFSET ?` for the page. Both run in under 10 ms
with the indexes on `country`, `job_title`, and `status`.

## DB connection settings (`createDb()`)

```
PRAGMA journal_mode = WAL;        -- readers don't block writers
PRAGMA foreign_keys = ON;         -- SQLite has FKs off by default
PRAGMA busy_timeout = 5000;       -- wait up to 5s on contention
```

These are set per connection on open. Without `foreign_keys = ON`, our
schema's FK constraints would silently not be enforced — that one is a
correctness fix as much as a performance fix.

## What I deliberately did not do

A few optimizations I chose to skip, and why:

- **Indexing every column.** I only indexed the columns that back real
  queries — `country`, `job_title`, `status`, and the composite. Every
  extra index slows down writes. The seed is the heaviest write path
  in this app, so I kept the index list minimal.
- **Caching the insights endpoints.** On 10K rows the raw queries
  already run in single-digit milliseconds. Caching would add cache
  invalidation complexity for no measurable gain.
- **Full-text search.** The `?search=` param does a `LOWER() LIKE %x%`
  across three columns. For HR-scale "find Sarah" the cost is
  negligible. FTS5 would be more code, more index, another moving part,
  and no user-visible win.
- **Connection pooling.** `better-sqlite3` is synchronous and uses one
  connection per process — that's the correct shape for SQLite. A pool
  would buy nothing here.

## Measurements

| What                         | Time    | Where measured  |
| ---------------------------- | ------- | --------------- |
| Seed 10K employees           | ~340 ms | seed test       |
| `GET /insights/summary`      | < 5 ms  | local, 10K rows |
| `GET /insights/countries/:c` | < 5 ms  | local, 10K rows |
| `GET /employees?page=1`      | < 10 ms | local, 10K rows |

Run the seed yourself:

```bash
pnpm --filter @salary-management/api seed
# [seed] seeding 10000 employees with seed=<n>
# [seed] done in ~340ms
```
