# Contributor Checklist

Follow this checklist before requesting a review. It mirrors the repository
automation (Husky + GitHub Actions) and the expectations documented in
`AGENTS.md`.

## Pre-flight

- [ ] The change is described in the pull request summary with context and links
      to any related issues.
- [ ] Conventional Commit message prepared (e.g. `feat(api): add cash-out limit`).
- [ ] New environment variables, migrations, or docker-compose updates are
      called out in the PR description.

## Quality gates

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm test:contract` (required whenever the OpenAPI contract or SDKs
      change)
- [ ] `pnpm gen:sdks` (run and commit results when the contract changes)

## Documentation

- [ ] OpenAPI spec updates live in `openapi/openapi.yaml` and were linted with
      `pnpm oas:lint`.
- [ ] Redoc preview rebuilt with `pnpm oas:docs` when sharing external contract
      updates.
- [ ] Relevant manuals in `docs/manuals/` mention new user-facing behaviour.
- [ ] `docs/index.html` links to any new documentation artefacts.
