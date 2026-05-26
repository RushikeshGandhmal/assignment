# Deployment Guide

This walks you through deploying the app end-to-end:

- **API** (Express + SQLite) → **Render** (free tier, no credit card).
- **UI** (Next.js) → **Vercel** (free tier, no credit card).

Total time: ~20 minutes the first time. Once it's set up, every
`git push` to `main` redeploys both automatically.

## Important: how data works on the free tier

Render's free plan has **no persistent disk**. That means:

- Every cold start (after ~15 minutes of inactivity, or when Render
  recycles the container) starts with a **fresh SQLite file**.
- The container's startup command runs `migrate` (creates the schema)
  then `seed` (inserts 10,000 employees + the demo admin user).
- So every cold start = same 10K-row dataset.
- A reviewer in an active session can add, edit, and delete employees,
  and the changes stick **until the next cold start**. Then the data
  resets back to the seeded 10,000.

This is the intentional trade-off for a free, always-available demo
URL. A persistent disk is a paid Render add-on; if you want edits to
survive forever, that's the upgrade.

## What you need before starting

- A **GitHub** repo with this code pushed to it.
- A **Render** account ([sign up](https://dashboard.render.com/register)).
  Sign in with GitHub — no credit card required.
- A **Vercel** account ([sign up](https://vercel.com/signup)). Same —
  GitHub sign-in, no card.

## Why we have these files

| File                  | Purpose                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/Dockerfile` | Builds a production Node 20 image. Multi-stage so the runtime image only contains the built `dist/` and production deps.    |
| `.dockerignore`       | Stops `node_modules`, `dist`, tests, and `apps/web/` from being uploaded as part of the build context (speeds up builds).   |
| `render.yaml`         | Tells Render how to provision the service (Docker runtime, free plan, env vars, region). Lives in git so it's reproducible. |

---

## Part 1 — Deploy the API to Render

### 1.1 Push the repo to GitHub

If you haven't already:

```bash
git push origin main
```

Render reads the repo directly from GitHub — no CLI install needed.

### 1.2 Create a new Blueprint on Render

A "Blueprint" is Render's term for "deploy everything declared in
`render.yaml`."

1. Open [https://dashboard.render.com/blueprints](https://dashboard.render.com/blueprints).
2. Click **New Blueprint Instance**.
3. **Connect a GitHub repo** — authorize Render's GitHub app if it's
   your first time, then pick the salary-management repo.
4. Render reads `render.yaml` from the repo root. You should see:
   - Service: `salary-management-api`
   - Runtime: Docker
   - Plan: Free
   - Region: Oregon (US West)
5. **Blueprint Name**: pick anything memorable, e.g.
   `salary-management`.
6. Click **Apply**.

Render starts building. The first build takes **5–8 minutes** (it
downloads the Node base image, installs all pnpm deps, builds the
shared package, compiles the API, creates the runtime image).

### 1.3 Watch the build logs

On the service detail page, click **Logs**. You should see in order:

```
==> Building image from ./apps/api/Dockerfile
...
==> Build successful
==> Starting service
Migrations applied to ./data/salary-management.db
[seed] target=./data/salary-management.db count=10000 randomSeed=42
[seed] done in ~340ms
[api] listening on http://localhost:4000
[api] database: ./data/salary-management.db
==> Your service is live 🎉
```

Note the URL Render assigns — it'll look like:

```
https://salary-management-api.onrender.com
```

(The exact suffix depends on what name was free at the time.) **Write
this down** — you'll need it for the Vercel step.

### 1.4 Smoke test the API

```bash
curl https://<your-render-api>.onrender.com/health
# → {"status":"ok"}
```

> If the first request takes 30–60 seconds, that's a **cold start**.
> Render free spins the container down after 15 minutes of inactivity,
> then spins it back up on the next request. Subsequent requests are
> instant.

Verify auth + insights:

```bash
# Login (saves cookie)
curl -i -X POST https://<your-render-api>.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hr@example.com","password":"changeme123"}' \
  -c /tmp/render-cookies.txt

# Insights summary
curl https://<your-render-api>.onrender.com/insights/summary \
  -b /tmp/render-cookies.txt
# → { "totalHeadcount": 10000, "totalPayrollUsd": ..., ... }
```

If both succeed, the API is done.

---

## Part 2 — Deploy the UI to Vercel

### 2.1 Import the repo into Vercel

1. Go to [https://vercel.com/new](https://vercel.com/new).
2. Click **Import** next to your salary-management repo.
3. On the configuration page:
   - **Framework Preset**: Next.js (auto-detected).
   - **Root Directory**: click **Edit** → set to `apps/web`. **Critical** —
     without this Vercel won't find the Next.js app.
   - **Build & Output Settings**: leave the defaults (pnpm is
     auto-detected from `pnpm-lock.yaml`).
4. **Don't click Deploy yet** — set the env var first.

### 2.2 Set the env var

On the same Vercel import screen, expand **Environment Variables** and
add one row:

| Name                  | Value                                    |
| --------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_API_URL` | `https://<your-render-api>.onrender.com` |

Make sure it's enabled for **Production, Preview, and Development**.

> The `NEXT_PUBLIC_` prefix is mandatory — Next.js only exposes env
> vars with that prefix to the browser bundle.

### 2.3 Deploy

Click **Deploy**. Vercel:

1. Runs `pnpm install` from the workspace root.
2. Runs the root `postinstall` hook, which builds
   `packages/shared`.
3. Runs `pnpm build` inside `apps/web` (Next.js production build).
4. Hosts the result at `https://<your-vercel-project>.vercel.app`.

First deploy: ~2 minutes.

**Write down the Vercel URL** — e.g.
`https://salary-management.vercel.app`.

---

## Part 3 — Connect them

The UI is live but the API is still rejecting it with CORS (it currently
only allows `http://localhost:3000`). Tell the API to trust the Vercel
URL.

1. Go to [your Render dashboard](https://dashboard.render.com) → the
   `salary-management-api` service.
2. Click **Environment** in the left sidebar.
3. Find `CORS_ORIGIN` in the list.
4. Click the pencil icon and change the value to:
   ```
   https://<your-vercel-project>.vercel.app
   ```
5. Click **Save Changes**.

Render automatically redeploys (~1–2 minutes) with the new value.

> If you later set up a custom domain on Vercel, list both in this
> variable: `https://app.example.com,https://<your-vercel-project>.vercel.app`.
> The middleware supports comma-separated values.

### Smoke test the full app

1. Open `https://<your-vercel-project>.vercel.app` in your browser.
2. You should be redirected to `/login` with the demo credentials
   pre-filled.
3. Click **Sign in**.
4. Dashboard loads with 10,000 employees, payroll in USD, headcount-
   by-country table, country drilldown.
5. Click **Employees** in the nav — paginated list loads.
6. Try adding a new employee — toast confirms success.

Done.

---

## Environment variables — one-page reference

### API (Render env vars)

| Name            | Where                             | Example                         | Notes                                                                                |
| --------------- | --------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| `JWT_SECRET`    | Render dashboard (auto-generated) | 64-char random hex              | Generated once when Render creates the service. Don't change unless rotating tokens. |
| `CORS_ORIGIN`   | Render dashboard (you set)        | `https://<your-app>.vercel.app` | Comma-separated for multiple origins. No trailing slash.                             |
| `NODE_ENV`      | `render.yaml`                     | `production`                    | Enables Secure cookies. Don't override.                                              |
| `PORT`          | `render.yaml`                     | `4000`                          | Internal container port. Render handles external 443 routing.                        |
| `DATABASE_FILE` | `render.yaml`                     | `./data/salary-management.db`   | Ephemeral path (no persistent disk on free tier).                                    |

### UI (Vercel env vars)

| Name                  | Where                                | Example                                  | Notes                                                      |
| --------------------- | ------------------------------------ | ---------------------------------------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | Vercel project → Settings → Env Vars | `https://<your-render-api>.onrender.com` | Must include the `NEXT_PUBLIC_` prefix. No trailing slash. |

### Local dev (`apps/api/.env`)

Already documented in `apps/api/.env.example`:

```bash
PORT=4000
DATABASE_FILE=./data/salary-management.db
JWT_SECRET=dev-only-secret-change-me-please
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

The UI doesn't need a `.env.local` for dev — the default API URL is
`http://localhost:4000` (see `apps/web/.env.example` for the full
list of supported web env vars). Add one only if your API runs on a
different port:

```bash
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4001
```

---

## Re-deploying after code changes

Both Render and Vercel auto-deploy on every push to `main`:

- **API**: Render webhook triggers a fresh Docker build (~3–5 min on
  warm cache).
- **UI**: Vercel detects the push and rebuilds (~2 min).

To force a redeploy without a commit:

- Render: dashboard → service → **Manual Deploy** → "Clear build cache
  and deploy" if you want to re-pull all layers.
- Vercel: dashboard → project → **Redeploy** on the latest deployment.

---

## Troubleshooting

| Symptom                                                       | Cause                                                                | Fix                                                                                                                                                |
| ------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| First request takes 30–60 seconds                             | Render free cold start                                               | Normal. Subsequent requests are instant. To keep the service warm, an external cron pinging `/health` every 10 minutes works (free options exist). |
| UI shows "Could not reach the server"                         | Wrong `NEXT_PUBLIC_API_URL` on Vercel **or** `CORS_ORIGIN` on Render | Open browser devtools → Network tab → look at the failing request URL and any CORS error in the console. Confirm both env vars match exactly.      |
| API responds 401 but the UI says "Could not reach the server" | CORS, not auth                                                       | Open devtools — if you see CORS errors in the console, update `CORS_ORIGIN` on Render.                                                             |
| `pnpm install` fails on Vercel                                | Vercel needs the workspace root configured                           | Confirm Vercel project → Settings → **Root Directory** = `apps/web`. Vercel walks up to find `pnpm-lock.yaml`.                                     |
| Login succeeds in curl but not in browser                     | Cookie not being set (Secure + cross-site)                           | Confirm Render `NODE_ENV=production` (Secure flag) and Vercel URL is `https://` (not `http://`).                                                   |
| "Cannot find module '@salary-management/shared'" in build     | Postinstall didn't run                                               | Confirm root `package.json` has `"postinstall": "pnpm --filter @salary-management/shared build"`. The Dockerfile and Vercel both rely on it.       |
| Render build OOM (out of memory)                              | Free tier has 512 MB during build                                    | Already handled — the Dockerfile uses multi-stage and only copies the built artifacts to the runtime layer.                                        |

---

## Cost expectations

Render free tier:

- 750 hours/month of compute (one always-on service uses 720 hours/
  month — covered).
- 100 GB/month outbound bandwidth.
- Spins down after 15 minutes of inactivity; spins back up on the next
  request (30–60s cold start).
- 512 MB RAM, 0.1 CPU.

Vercel Hobby:

- 100 GB bandwidth/month.
- Unlimited static deployments.
- Serverless functions if used (we don't use them on the UI side).

Both fit this app entirely.

---

## Decommissioning (when you're done)

- **Render**: dashboard → service → **Settings** → bottom of the page →
  **Delete Service**.
- **Vercel**: project → **Settings** → **Advanced** → **Delete
  Project**.
- **GitHub**: optional. The repo isn't billed; it can stay.
