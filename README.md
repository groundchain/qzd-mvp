# qzd-mvp

This repository contains the Quetzal Digital MVP monorepo managed with pnpm workspaces. It includes:

- **apps/api** – NestJS REST API exposing health checks.
- **apps/wallet-web** – React + Vite wallet interface.
- **apps/admin-web** – React + Vite admin console.
- **packages/shared** – Shared Zod schemas, DTOs, and utility types.
- **packages/ledger** – TypeScript append-only ledger with signature support.
- **packages/sdk** – Browser/Node SDK wrapping the API and ledger helpers.
- **packages/sdk-api** – Generated OpenAPI server and client bindings consumed by other packages.

## Getting started

```bash
pnpm install
```

### Useful scripts

- `pnpm build` – Runs builds for every workspace.
- `pnpm test` – Executes tests across the monorepo.
- `pnpm lint` – Lints all packages.
- `pnpm typecheck` – Runs TypeScript checks for all packages.
- `pnpm gen:sdks` – Regenerates the OpenAPI server/browser/node clients in `@qzd/sdk-api`.
- `pnpm gen:all` – Regenerates clients and the shared OpenAPI TypeScript types.

Husky runs linting and type checking before commits, and GitHub Actions ensures CI parity on pull requests.

### Observability

- The API exposes Prometheus-compatible metrics at `GET /metrics` and health probes at `GET /health/live` and `GET /health/ready`.
- OpenTelemetry tracing is enabled by default and exports spans to an OTLP endpoint specified via `OTEL_EXPORTER_OTLP_ENDPOINT`.
- Run `docker compose up` to launch Prometheus on <http://localhost:9090> and Grafana on <http://localhost:3001>. Prometheus scrapes the local API instance via the `/metrics` endpoint.

### Documentation site

- `pnpm docs:dev` – starts VitePress on port 5170. Visit <http://localhost:5170/qzd-mvp/> to confirm the configured base path works locally.
- `pnpm docs:build && pnpm docs:preview` – build the static site and serve the production bundle on port 8088 for end-to-end verification before deploying.
