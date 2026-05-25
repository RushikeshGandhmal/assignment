# Salary Management

A minimal yet usable salary management tool for an organization with 10,000 employees.

> Built as part of an engineering assessment. See [`docs/`](./docs) for planning notes and design decisions.

## Status

Under active development. See git history for incremental progress.

## Structure

This is a [pnpm workspaces](https://pnpm.io/workspaces) monorepo.

```
/apps
  /api      → Express + TypeScript backend
  /web      → Next.js frontend
/packages
  /shared   → Shared Zod schemas and types
```

## Requirements

- Node.js >= 20
- pnpm >= 10

## Getting Started

```bash
pnpm install
```

More instructions will be added as the project evolves.
