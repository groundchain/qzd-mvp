# Operations Runbook

This runbook maps operational procedures to the OpenAPI endpoints implemented in
`apps/api`. Use it during incidents and routine maintenance.

## Quick references

| Scenario                   | Endpoints                                                                                   | Notes                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| API health check           | `GET /health/live`, `GET /health/ready`                                                     | Use `/health/live` for liveness and `/health/ready` before routing traffic.       |
| Metrics scrape             | `GET /metrics`                                                                              | Prometheus scrape target exposed by the NestJS server.                            |
| User onboarding outage     | `POST /auth/register`, `POST /accounts`, `POST /accounts/kyc`                               | Validate payloads and auth headers; see `apps/api/src/in-memory-bank.service.ts`. |
| Login/auth token issues    | `POST /auth/login`                                                                          | Inspect JWT configuration and expiry handling.                                    |
| Balance mismatch           | `GET /accounts/{id}/balance`, `GET /accounts/{id}/transactions`                             | Compare responses with ledger events in `packages/ledger`.                        |
| Transfer stuck in pending  | `POST /tx/transfer`                                                                         | Ensure idempotency keys are unique and inspect error payloads.                    |
| Issuance backlog           | `POST /tx/issue`, `GET /admin/issuance-requests`, `POST /admin/issuance-requests/{id}/sign` | Confirm validator quorum; retry signatures if the queue stalls.                   |
| Voucher redemption failure | `POST /agents/cashin`, `POST /agents/cashout`, `POST /agents/vouchers/{code}/redeem`        | Check agent idempotency keys and voucher lifecycle fields.                        |
| Remittance quote errors    | `POST /simulate/quote`, `POST /remit/us/acquire-qzd`                                        | Validate scenario flags and currency codes; align with wallet quote UI.           |
| Alert ingestion            | `GET /admin/alerts`, `POST /admin/alerts/{id}/ack`                                          | Verify the admin console receives alerts and ack responses return 204.            |
| SMS command errors         | `POST /sms/inbound`                                                                         | Use the SMS simulator (`pnpm --filter @qzd/sms-sim start`) to reproduce issues.   |

## Standard operating procedures

### 1. Confirm platform status

1. Call `GET /health/live` and `GET /health/ready`.
2. If `/health/ready` fails, inspect recent deployments and database connectivity.
3. Review Prometheus at <http://localhost:9090> and Grafana at
   <http://localhost:3001> when running via Docker Compose.

### 2. Regenerate SDKs after contract updates

1. Validate the contract with `pnpm oas:lint`.
2. Run `pnpm gen:sdks` and `pnpm gen:types`.
3. Execute `pnpm test:contract` to assert SDK compatibility against the Prism mock
   server (`pnpm oas:mock`).
4. Deploy updated packages to downstream applications.

### 3. Recover from degraded cash operations

1. Confirm agent API calls (`POST /agents/cashin`, `POST /agents/cashout`) are
   returning 202 responses. Retry idempotent requests with new keys if 409s are
   returned.
2. Inspect vouchers via `POST /agents/vouchers/{code}/redeem`; a 404 indicates a
   previously consumed or expired voucher.
3. Coordinate with admin operators to clear issuance backlog via
   `POST /admin/issuance-requests/{id}/sign`.

### 4. Handle SMS command regressions

1. Use the SMS simulator to send the failing command: `pnpm --filter @qzd/sms-sim start`.
2. Trace the API handler at `/sms/inbound` and ensure responses include a `reply`
   string.
3. Compare behaviour against the OpenAPI example payloads in `openapi/openapi.yaml`.

Document any novel remediation in this file so on-call engineers can repeat it.
