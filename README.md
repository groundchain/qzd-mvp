# qzd-mvp

This repository contains the Quetzal Digital MVP monorepo managed with pnpm workspaces. It includes:

- **apps/api** – NestJS REST API exposing health checks.
- **apps/wallet-web** – React + Vite wallet interface.
- **apps/admin-web** – React + Vite admin console.
- **packages/shared** – Shared Zod schemas, DTOs, and utility types.
- **packages/ledger** – TypeScript append-only ledger with signature support.
- **packages/sdk** – Browser/Node SDK wrapping the API and ledger helpers.

## Getting started

```bash
pnpm install
```

### Useful scripts

- `pnpm build` – Runs builds for every workspace.
- `pnpm test` – Executes tests across the monorepo.
- `pnpm lint` – Lints all packages.
- `pnpm typecheck` – Runs TypeScript checks for all packages.

Husky runs linting and type checking before commits, and GitHub Actions ensures CI parity on pull requests.
