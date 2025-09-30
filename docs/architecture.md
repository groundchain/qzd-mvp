# System Architecture

Quetzal Digital is organised as a pnpm-managed monorepo with a clear separation
between runtime applications, reusable packages, and generated SDKs.

## High-level topology

- **API (`apps/api`)** – NestJS service that exposes the OpenAPI contract defined
  in `openapi/openapi.yaml`. It orchestrates the in-memory ledger, validates
  requests with generated DTOs, and emits Prometheus metrics.
- **Wallet Web (`apps/wallet-web`)** – Vite + React single-page app for retail
  customers. It consumes the browser SDK to register, load balances, send
  transfers, and preview remittance quotes.
- **Admin Web (`apps/admin-web`)** – React console for operations teams to review
  alerts, shepherd issuance requests to completion, and redeem agent vouchers.
- **Merchant POS (`apps/merchant-pos`)** – React-based point-of-sale terminal that
  issues QR-code invoices and reconciles incoming wallet transfers.
- **SMS Simulator (`apps/sms-sim`)** – Node.js CLI that reproduces inbound SMS
  traffic against the `/sms/inbound` endpoint for manual testing.

Support packages include:

- **`packages/shared`** – TypeScript types shared across apps. Hosts the generated
  OpenAPI typings consumed by UI forms.
- **`packages/ledger`** – Append-only ledger and signature primitives used by the
  API service.
- **`packages/sdk`** – Thin wrappers around the generated API clients, adding
  ergonomic helpers and auth integration.
- **`packages/sdk-api`** – Generated clients for NestJS, browser fetch, and Axios
  environments. Never edit files in the `generated` directories.

## Environment orchestration

`docker-compose.yaml` spins up the entire developer stack:

- Postgres for persistence, seeded via `pnpm --filter @qzd/api exec node scripts/seed-dev.mjs`.
- The API service plus Wallet, Admin, Merchant POS, and SMS simulator frontends.
- Prism mock server for contract testing at <http://localhost:4010>.
- Observability stack (Prometheus + Grafana).
- Static docs served from `docs/` alongside a Redoc rendering of the contract.

Use `make dev` to launch the full stack or `make mock` when only Prism-backed
contract testing is required.
