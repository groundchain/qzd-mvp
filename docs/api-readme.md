# API Workflow Guide

The Quetzal Digital API is defined in [`openapi/openapi.yaml`](https://github.com/groundchain/qzd-mvp/blob/main/openapi/openapi.yaml).
All server handlers, SDKs, contract tests, and external documentation are generated
from this source of truth. Follow the workflow below whenever you need to change
an endpoint or schema.

## 1. Propose and edit the OpenAPI contract

1. Create a feature branch and update `openapi/openapi.yaml` with the
   desired changes. Keep tag descriptions and operation summaries consistent
   with the domain language used in the client applications.
2. Validate the contract locally before touching any code:

   ```bash
   pnpm oas:lint
   ```

   The command runs Redocly linting and will fail if breaking changes or
   documentation gaps are detected.

## 2. Regenerate server stubs and SDKs

Regenerate all derived artifacts so that the NestJS controllers and the TypeScript
clients stay aligned with the spec:

```bash
pnpm gen:sdks    # server + browser + node SDKs
pnpm gen:types   # shared TypeScript types consumed by @qzd/shared
```

You can also run `pnpm gen:all` to execute both commands in sequence. Never edit
files under `packages/sdk-api/src/*/generated`—they are replaced on every run.

## 3. Update tests and documentation

- Adjust handlers in `apps/api` and supporting domain packages to satisfy the new
  contract. Keep handlers thin and defer validation to the generated DTOs.
- Update Vitest suites, contract tests (`pnpm test:contract`), and manuals so they
  describe the new behaviour.
- Rebuild the HTML preview of the specification if you want to share it outside
  the monorepo:

  ```bash
  pnpm oas:docs   # outputs to openapi/dist/index.html
  ```

## 4. Verify before committing

Run the monorepo quality gates before raising a pull request:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:contract
```

The Husky hooks enforce these checks on CI, so running them locally keeps the
pipeline green. Capture any notable manual validation in your PR description.
