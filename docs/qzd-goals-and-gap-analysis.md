---
title: QZD MVP — Goals & Gap Analysis
sidebar: auto
---

## Executive Summary
- Quetzal Digital (QZD) ships as a pnpm monorepo with defined API, wallet, admin, merchant, and simulator apps plus shared packages, already documented in the architecture overview.【F:docs/architecture.md†L1-L42】
- The OpenAPI contract enumerates customer, remittance, admin, agent, offline, and observability endpoints, giving a strong API-first baseline for the MVP.【F:openapi/openapi.yaml†L1-L158】
- A NestJS API, in-memory banking service, and React frontends demonstrate end-to-end registration, transfers, issuance, and voucher flows via generated SDKs; however, they operate without real persistence or integration rails.【F:apps/api/src/app.module.ts†L1-L15】【F:apps/api/src/in-memory-bank.service.ts†L83-L196】【F:apps/wallet-web/src/App.tsx†L1-L200】【F:apps/admin-web/src/App.tsx†L1-L199】
- Docker Compose, observability scaffolding, and CI workflows cover local orchestration, metrics, and automated tests (contract, API e2e, UI smoke), but production-grade deployment tooling (path-based Nginx, secrets, migrations) remains aspirational.【F:docker-compose.yaml†L1-L153】【F:apps/api/src/observability/metrics.ts†L1-L27】【F:.github/workflows/ci.yml†L1-L240】
- To reach a functional, externally demo-able MVP we must harden persistence, security, AML/KYC enforcement, issuance approvals, offline redemption, and ops posture beyond the current in-memory, single-process demo implementations.【F:apps/api/src/in-memory-bank.service.ts†L83-L196】【F:apps/api/src/remittances.service.ts†L1-L120】
- Highest-priority gaps include production-ready data storage, identity verification tiers, remittance fee settlement, multi-channel distribution, and deployment hardening to serve wallet/admin/POS/docs behind one domain with TLS.【F:docs/deployment-single-server.md†L3-L120】【F:apps/merchant-pos/src/App.tsx†L1-L160】

## Current State (What Exists)
| Area | Status | Evidence | Notes |
| --- | --- | --- | --- |
| OpenAPI specification | Present | 【F:openapi/openapi.yaml†L1-L158】 | Comprehensive contract for auth, accounts, transactions, remittances, admin, agents, offline, SMS, and health endpoints. |
| Backend (NestJS API) | Present (demo-grade) | 【F:apps/api/src/app.module.ts†L1-L15】【F:apps/api/src/in-memory-bank.service.ts†L83-L196】 | API wires generated controllers to an in-memory bank service implementing accounts, issuance, vouchers, AML alerts, and offline vouchers with no external persistence. |
| Remittance & issuance logic | Present (simulated) | 【F:apps/api/src/remittances.service.ts†L1-L120】 | Ledger-backed remittance issuance with hard-coded validators, FX/fee scenarios, and synthetic multi-sig. |
| Wallet web app | Present | 【F:apps/wallet-web/src/App.tsx†L1-L200】 | React SPA supports registration/login, balance retrieval, transfers, remittance quotes, and offline voucher redemption via browser SDK. |
| Admin console | Present | 【F:apps/admin-web/src/App.tsx†L1-L199】 | React SPA handles issuance queue, validator signing, voucher reconciliation; relies on manual token entry and demo signing keys. |
| Merchant POS | Present | 【F:apps/merchant-pos/src/App.tsx†L1-L160】 | React POS issues invoices, renders QR codes/PDFs, polls transactions using SDK; assumes demo auth and lacks settlement hooks. |
| SMS simulator | Present | 【F:docs/architecture.md†L16-L19】 | CLI described in docs; implementation resides in repo (not inspected here). |
| Shared packages | Present | 【F:docs/architecture.md†L21-L30】【F:packages/ledger/src/index.ts†L1-L80】 | Shared Zod schemas, append-only ledger, SDK wrappers, and card mock utilities enable API/UI parity. |
| Docker Compose | Present (dev-focused) | 【F:docker-compose.yaml†L1-L153】 | Spins up Postgres, API, wallet/admin dev servers, SMS simulator, Prism mock, docs server, Prometheus, Grafana; lacks production images and proxy. |
| Nginx path routing | Missing | 【F:docs/deployment-single-server.md†L3-L120】 | Deployment guide defines desired proxy, but repo lacks a consolidated Nginx config or automation to apply it. |
| Tests (unit/e2e/UI) | Present | 【F:apps/api/src/admin-alerts.e2e.spec.ts†L1-L160】【F:tests/ui/wallet-smoke.spec.ts†L1-L50】 | Vitest API e2e suites cover AML alerts, issuance, flows; Playwright smoke tests exercise wallet UI. |
| CI/CD workflows | Present (comprehensive) | 【F:.github/workflows/ci.yml†L1-L320】 | Pipeline enforces spec lint/diff, contract tests, unit coverage, API e2e, accessibility, wallet smoke; no deploy stage. |
| Observability | Partial | 【F:apps/api/src/observability/metrics.ts†L1-L27】【F:ops/prometheus/prometheus.yml†L1-L13】【F:ops/grafana/datasources/prometheus.yml†L1-L9】 | Metrics controller, Prometheus scrape config, Grafana datasource exist; dashboards absent. |
| Documentation | Present | 【F:docs/index.md†L1-L40】【F:docs/deployment-single-server.md†L3-L160】 | VitePress site with architecture, deployment, manuals, runbooks; Redoc served statically. |

## Definition of “Functional Product” for MVP
To demo an end-to-end CBDC remittance, the MVP must allow a user to acquire QZD with test funds, send to a recipient wallet, and cash out via an agent while KYC/AML limits and alerting function, issuance approvals require multi-sig, docs/mock APIs are public, and the stack deploys under one TLS-protected domain with path routing across /api, /wallet, /admin, /pos, and /docs.【F:apps/wallet-web/src/App.tsx†L1-L200】【F:apps/admin-web/src/App.tsx†L1-L199】【F:apps/api/src/remittances.service.ts†L1-L120】【F:docs/deployment-single-server.md†L3-L120】

## Gap Analysis (What’s Missing & Why It Matters)
### OAS3 & Codegen
- **Gap:** Spec lacks production deployment alignment (server URLs, auth scopes) and example parity with real limits.
  - **Impact:** Blocks accurate SDK/client behaviour and partner integrations.
  - **Evidence:** Spec references sandbox/production URLs but no versioned change log or auth scope definitions.【F:openapi/openapi.yaml†L1-L40】
  - **Suggested fix:** Finalize environment matrix, document auth flows (KYC tiers, agent roles), and generate changelog.
  - **Effort:** M
  - **Priority:** P1

### Backend Services
- **Gap:** No persistent data store or ORM; all state in-memory.
  - **Impact:** Prevents multi-instance deployment, data durability, compliance.
  - **Evidence:** App module wires only `InMemoryBankService`; no database modules used.【F:apps/api/src/app.module.ts†L1-L15】
  - **Suggested fix:** Introduce Postgres schema with migration tooling, replace in-memory service with repository layer.
  - **Effort:** L
  - **Priority:** P0
- **Gap:** AML/KYC rules are demo heuristics without audit persistence.
  - **Impact:** Cannot satisfy regulatory reporting or override flows.
  - **Evidence:** Threshold constants for structuring/velocity defined inline with no persistence of events beyond memory.【F:apps/api/src/in-memory-bank.service.ts†L126-L196】
  - **Suggested fix:** Externalize rules engine, persist alerts, add review states.
  - **Effort:** M
  - **Priority:** P0

### Wallet UIs
- **Gap:** Wallet requires manual account ID entry and lacks guided onboarding or remittance rails.
  - **Impact:** Demo friction; not representative of production user journey.
  - **Evidence:** UI expects user to paste account IDs and tokens manually.【F:apps/wallet-web/src/App.tsx†L87-L200】
  - **Suggested fix:** Add authenticated session storage, auto-fetch account, integrate remittance purchase flow.
  - **Effort:** M
  - **Priority:** P1

### Admin/Issuance
- **Gap:** Admin console depends on manual token input and hard-coded validator list.
  - **Impact:** Multi-sig issuance not secured; no role-based access.
  - **Evidence:** Admin UI asks for token, enumerates validators array.【F:apps/admin-web/src/App.tsx†L17-L199】
  - **Suggested fix:** Implement auth flow with admin login, validator key management, signature auditing.
  - **Effort:** M
  - **Priority:** P0

### POS
- **Gap:** POS lacks settlement integration and relies on manual registration.
  - **Impact:** Merchants cannot reconcile with real cash-out or receipts.
  - **Evidence:** POS registers users via API and polls transactions; no payout channels.【F:apps/merchant-pos/src/App.tsx†L1-L160】
  - **Suggested fix:** Connect to agent payout API, persistent merchant accounts, ledger reconciliation.
  - **Effort:** M
  - **Priority:** P1

### KYC/AML
- **Gap:** No external KYC provider or document handling; tiers simulated only.
  - **Impact:** Cannot satisfy regulatory onboarding.
  - **Evidence:** `updateAccountKyc` handled in-memory; no document storage or verification pipeline.【F:apps/api/src/in-memory-bank.service.ts†L83-L140】
  - **Suggested fix:** Integrate KYC provider, store evidence, enforce tier limits server-side.
  - **Effort:** L (for integration) to M (for workflows)
  - **Priority:** P0

### Remittance Rails & Fees
- **Gap:** Acquisition uses fixed FX and fees without funding rails.
  - **Impact:** Cannot demonstrate real remittance cost savings.
  - **Evidence:** Remittance service hard-codes FX ratio and validators.【F:apps/api/src/remittances.service.ts†L1-L60】
  - **Suggested fix:** Connect to sandbox remittance provider, dynamic FX feeds, configurable tariffs.
  - **Effort:** L-M
  - **Priority:** P1

### Offline/Physical
- **Gap:** Offline vouchers/cards simulated only; no hardware workflows.
  - **Impact:** Physical resilience scenario remains theoretical.
  - **Evidence:** Card mock utilities generate vouchers without device provisioning.【F:packages/card-mock/src/index.ts†L1-L73】
  - **Suggested fix:** Define card personalization flow, secure key management, offline redemption audit.
  - **Effort:** L
  - **Priority:** P2

### Security & Keys
- **Gap:** Request signing keys, validator secrets, and JWT secrets unmanaged.
  - **Impact:** Cannot operate securely in shared environments.
  - **Evidence:** Demo defaults for signing keys across apps; no secret management integration.【F:apps/wallet-web/src/App.tsx†L17-L33】【F:apps/admin-web/src/App.tsx†L11-L22】
  - **Suggested fix:** Provision secret store (Vault/SSM), rotate keys, enforce env-based configuration.
  - **Effort:** M
  - **Priority:** P0

### Observability
- **Gap:** No Grafana dashboards or alerting rules.
  - **Impact:** Ops teams lack actionable visibility.
  - **Evidence:** Prometheus scrape config exists; Grafana datasource only.【F:ops/prometheus/prometheus.yml†L1-L13】【F:ops/grafana/datasources/prometheus.yml†L1-L9】
  - **Suggested fix:** Define dashboards for transactions, AML alerts, issuance queue; add alertmanager config.
  - **Effort:** S
  - **Priority:** P1

### Testing (Step #19)
- **Gap:** Tests run against in-memory state; no DB migrations or rate-limit tests.
  - **Impact:** Fails to cover persistence, concurrency, replay, or quota handling.
  - **Evidence:** CI runs contract, unit, API e2e, wallet smoke; no DB-specific steps.【F:.github/workflows/ci.yml†L1-L320】
  - **Suggested fix:** Extend suites with Postgres migrations, rate-limit, replay, and AML scenario coverage once persistence lands.
  - **Effort:** M
  - **Priority:** P0

### DevEx & CI/CD
- **Gap:** No automated image builds/deploy or environment promotion.
  - **Impact:** Manual deploy risk, inconsistent environments.
  - **Evidence:** CI lacks build/publish stages for production beyond tests.【F:.github/workflows/ci.yml†L1-L320】
  - **Suggested fix:** Add build pipeline, container image publishing, staged deploy workflows.
  - **Effort:** M
  - **Priority:** P1

### Docs & API Reference
- **Gap:** Docs describe desired state but lack gap-tracking updates.
  - **Impact:** Stakeholders may assume features exist.
  - **Evidence:** Architecture doc presents Postgres-backed deployments despite in-memory reality.【F:docs/architecture.md†L8-L40】
  - **Suggested fix:** Update docs to distinguish demo vs production-ready capabilities until gaps close.
  - **Effort:** S
  - **Priority:** P1

### Ops (Nginx/TLS/Backups)
- **Gap:** No live Nginx config, backup scripts, or zero-downtime deploy automation.
  - **Impact:** Production deployment remains manual and fragile.
  - **Evidence:** Deployment guide outlines goals; compose lacks proxy/backups.【F:docs/deployment-single-server.md†L3-L160】【F:docker-compose.yaml†L1-L153】
  - **Suggested fix:** Commit production compose overrides, Nginx config, backup cron jobs, blue/green compose flow.
  - **Effort:** M
  - **Priority:** P0

## Prioritized Backlog (Actionable)
| Epic | Task | Acceptance Criteria | Owner | Unblocks |
| --- | --- | --- | --- | --- |
| Persistent Core Services | Implement Postgres schema & migrations replacing in-memory bank | API bootstraps with Postgres, migrations run in CI, e2e tests persist data across restarts | Backend | Most other P0 items |
| Persistent Core Services | Wire repositories for accounts, transactions, alerts, vouchers | All CRUD endpoints operate via Postgres with optimistic locking; AML alerts stored for audit | Backend | KYC/AML, Issuance |
| Secure Admin & Issuance | Add admin auth service with role-based JWTs and validator key storage | Admin login via UI; validator signatures recorded with key rotation policy | Backend/Frontend | Multi-sig compliance |
| Secure Admin & Issuance | Update admin UI for session handling, validator assignment UI | Admin can log in, view issuance queue, sign, escalate; acceptance via Playwright regression | Frontend | - |
| Remittance Rails | Integrate FX feed and remittance funding sandbox | Quotes use live FX, fee schedule configurable; acquisition reconciles funding ledger entry | Backend | Demo credibility |
| Wallet UX Refresh | Simplify onboarding (auto account linking) & guided remittance send | Wallet auto fetches user account post-login; remittance flow completes without manual IDs | Frontend | Demo polish |
| Ops Hardening | Add Nginx reverse proxy config + TLS automation to repo | `docker compose -f prod.yml up` exposes /api,/wallet,/admin,/pos,/docs via HTTPS | DevOps | Launch readiness |
| Ops Hardening | Define backup/restore scripts for Postgres & secrets | Documented runbook; CI smoke verifies backup artifacts | DevOps | Compliance |
| Observability | Publish Grafana dashboards & alert rules for key KPIs | Dashboards versioned in repo; alertmanager config triggers on AML bursts, issuance backlog | DevOps | Ops readiness |
| Testing Step #19 | Extend suites for DB migrations, rate limits, replay, AML scenarios | CI includes new jobs with fixtures, fails on regressions | QA/Backend | Quality gates |

## Testing Strategy (Step #19) – Concrete Next Steps
- Stand up Postgres-backed contract tests and ensure Prism mock parity for all P0 endpoints once persistence lands.【F:docker-compose.yaml†L1-L90】【F:.github/workflows/ci.yml†L1-L240】
- Enforce `pnpm oas:lint` and `oasdiff` in CI (already present) with spec drift blocking merges; add diff-to-main reports in PR templates.【F:.github/workflows/ci.yml†L1-L60】
- Add Vitest suites for ledger math (transfers, fees, issuance) against new persistence layer.【F:packages/ledger/src/index.ts†L1-L80】
- Run API e2e against ephemeral DB containers with migrations applied before tests.【F:.github/workflows/ci.yml†L120-L200】
- Implement idempotency/replay protection tests via repeated transfer requests and transaction journals.【F:apps/api/src/in-memory-bank.service.ts†L138-L172】
- Add rate-limit coverage for request security middleware once backed by persistent counters.【F:apps/api/src/in-memory-bank.service.ts†L198-L200】
- Extend AML tests to cover structuring, velocity, new-account bursts with persisted audit logs.【F:apps/api/src/admin-alerts.e2e.spec.ts†L82-L160】
- Expand Playwright suites to cover admin flows after secure auth refactor.【F:tests/ui/wallet-smoke.spec.ts†L1-L50】
- Configure coverage thresholds and gating for new persistence modules in CI.【F:.github/workflows/ci.yml†L80-L200】

## Deployment & Ops Readiness
- Commit production Docker Compose overlays with versioned images, Postgres volumes, and integrated Nginx reverse proxy to expose /api, /wallet, /admin, /pos, /docs under one TLS domain.【F:docs/deployment-single-server.md†L3-L160】
- Package Prometheus and Grafana configs (dashboards, alerts) to monitor API `/metrics`, AML alerts, issuance backlog.【F:ops/prometheus/prometheus.yml†L1-L13】
- Document and automate Postgres backups (pg_dump + WAL archiving) with restore drills; integrate secrets management for signing keys and JWT secrets.【F:docker-compose.yaml†L1-L90】【F:apps/wallet-web/src/App.tsx†L17-L33】
- Establish zero-downtime deployment workflow (`docker compose pull && docker compose up -d`) with health checks to guard cutovers.【F:docs/deployment-single-server.md†L3-L120】

## Security & Compliance Notes
- Harden request-signing key exchange and storage; all SPAs currently share dev keys bundled in source, unacceptable for production.【F:apps/wallet-web/src/App.tsx†L17-L33】【F:apps/admin-web/src/App.tsx†L11-L22】
- Implement secure multi-sig issuance with validator quorum persisted and auditable beyond hard-coded keys.【F:apps/api/src/remittances.service.ts†L16-L60】
- Persist KYC documents, tier decisions, and AML alerts with immutable audit logs and retention policies.【F:apps/api/src/in-memory-bank.service.ts†L83-L196】
- Enforce rate limits, anomaly detection, and agent cash in/out monitoring via centralized services rather than in-process state.【F:apps/api/src/in-memory-bank.service.ts†L138-L200】

## Risks, Dependencies, Open Questions
- **External partners:** Need agreements and sandbox access for remittance FX providers, agent networks, and identity vendors; current stack stubs these integrations.【F:apps/api/src/remittances.service.ts†L1-L60】
- **Regulatory assumptions:** Architecture docs presume Banguat-backed issuance with Postgres persistence and official docs; confirm data residency and audit requirements.【F:docs/architecture.md†L8-L40】
- **Offline readiness:** Physical voucher/card workflows rely on mock keypairs; hardware personalization, secure storage, and offline agent reconciliation remain undefined.【F:packages/card-mock/src/index.ts†L1-L73】
- **Performance:** In-memory implementation hides latency/scale concerns; need load testing once Postgres & Nginx proxies are added.【F:docker-compose.yaml†L1-L90】
- **Open questions:** How will embassy outposts and kiosks integrate? What are acceptable remittance fee subsidies? Who manages validator keys and quorum policies? How are AML escalations handled cross-agency? (Inputs required from Banguat/SENACYT/Ministry of Economy.)

## Appendix
- **Specifications:** `openapi/openapi.yaml` (primary API contract).【F:openapi/openapi.yaml†L1-L158】
- **Backend reference:** `apps/api/src/in-memory-bank.service.ts` (current domain logic), `apps/api/src/remittances.service.ts` (remittance ledger).【F:apps/api/src/in-memory-bank.service.ts†L83-L196】【F:apps/api/src/remittances.service.ts†L1-L120】
- **Frontends:** Wallet/Admin/POS SPA entry points demonstrate SDK usage and UI flows.【F:apps/wallet-web/src/App.tsx†L1-L200】【F:apps/admin-web/src/App.tsx†L1-L199】【F:apps/merchant-pos/src/App.tsx†L1-L160】
- **Testing harnesses:** Vitest e2e specs for alerts/flows and Playwright smoke located under `apps/api/src/*.e2e.spec.ts` and `tests/ui`.【F:apps/api/src/admin-alerts.e2e.spec.ts†L1-L160】【F:tests/ui/wallet-smoke.spec.ts†L1-L50】
- **Operational tooling:** `docker-compose.yaml`, Prometheus/Grafana configs, deployment guide for single-server path routing.【F:docker-compose.yaml†L1-L153】【F:ops/prometheus/prometheus.yml†L1-L13】【F:docs/deployment-single-server.md†L3-L160】
