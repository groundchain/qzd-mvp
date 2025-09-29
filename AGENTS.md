# Repository Guidelines

## Project Structure & Module Organization
- Operate from repo root; pnpm manages workspaces and `pnpm --filter <workspace> …` scopes commands.
- `apps/api` (NestJS), `apps/wallet-web` and `apps/admin-web` (Vite + React), and `apps/sms-sim` (SMS simulator) are the runtime services.
- `packages/shared` carries Zod contracts, `packages/ledger` and `packages/sdk` expose domain logic, and `sdk-api`, `sdk-browser`, `sdk-node` contain generated bindings—regenerate locally and never commit OpenAPI generator outputs (`packages/sdk-api/src/*/generated`).
- Contracts live in `openapi/`; generators in `scripts/`; shared lint/format/TS config resides in `eslint.config.mjs`, `.prettierrc`, and `tsconfig.base.json`.
- Follow API-first flow: update `openapi/openapi.yaml` before changing handlers, SDKs, or tests so regenerated clients stay authoritative.

## Build, Test, and Development Commands
- Run `pnpm gen:sdks` (or `pnpm gen:all` when types shift) before any build so sources reflect the spec.
- `pnpm install` bootstraps dependencies; `pnpm build`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` fan out across workspaces—pair with `--filter` for focused work.
- `pnpm --filter @qzd/api dev` starts the API; switch the filter to wallet or admin to launch Vite dev servers.
- `pnpm test:contract` spins up Prism via `tests/contract-mock-server.ts` and validates SDKs; `make regen`, `make mock`, and `make dev` wrap docker-compose flows.

## Coding Style & Naming Conventions
- Prettier enforces 2-space indentation, single quotes, semicolons, and a 100-character limit—format via editor or `pnpm exec prettier --write <paths>`.
- Use PascalCase for components/classes, camelCase for functions/variables, and kebab-case filenames unless tooling dictates otherwise.
- ESLint layers `@typescript-eslint`, `react-hooks`, and `react-refresh`; clear warnings locally so Husky passes.
- Regenerate (`pnpm gen:sdks` or `pnpm gen:all`) instead of editing any generated folder.

## Testing Guidelines
- Vitest drives unit and integration coverage; colocate specs as `*.test.ts` or `*.test.tsx` beside implementation.
- React suites rely on Testing Library; assert on user behaviour and clean up DOM fixtures.
- Contract checks need the OpenAPI mock—if `pnpm test:contract` fails, start Prism with `pnpm oas:mock` or `make mock` before debugging code.

## Commit & Pull Request Guidelines
- Every commit must follow Conventional Commits (`type(scope): summary`) with optional workspace scopes such as `feat(api): …`.
- Keep subjects imperative and under 72 characters; add context or issue links in bodies as needed.
- Pull requests should summarize intent, list verification commands, and attach UI evidence when behaviour changes.
- Flag migrations, env vars, or docker-compose updates so reviewers can reproduce quickly.
