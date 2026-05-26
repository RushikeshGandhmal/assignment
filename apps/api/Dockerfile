# syntax=docker/dockerfile:1.7

# Build stage — installs all workspace deps and compiles shared + api
FROM node:20-bookworm-slim AS builder
RUN corepack enable
WORKDIR /app

# Copy the whole monorepo. We rely on Docker's layer cache invalidating on
# source changes; for an assessment-sized repo this is simpler than the
# multi-step fetch/install pattern and still builds in seconds on warm cache.
COPY . .

# pnpm install runs the root postinstall which builds packages/shared,
# so the api build below can resolve @salary-management/shared.
RUN pnpm install --frozen-lockfile

# Compile apps/api to apps/api/dist
RUN pnpm --filter @salary-management/api build

# Runtime stage — slim image with only what's needed to run
FROM node:20-bookworm-slim AS runtime
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

# node_modules trees (workspace-aware — pnpm symlinks resolve correctly)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# Built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=builder /app/apps/api/seed-data ./apps/api/seed-data
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

# Workspace manifests so pnpm symlinks resolve at runtime
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

WORKDIR /app/apps/api
EXPOSE 4000

# On Render's free tier there is no persistent disk: the container's
# filesystem resets on every cold start. So on each boot we:
#   1) migrate — creates the schema in the fresh SQLite file
#   2) seed    — inserts 10,000 employees + the demo HR admin user
#   3) start   — Express listens on PORT
# Seed is idempotent and only takes ~340ms, so always running it is safe.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/seed/run.js && node dist/server.js"]
