# Admin Operator Manual

The admin console (`apps/admin-web`) gives operations staff tools to manage
issuance queues and agent vouchers. It expects a privileged access token issued
by the API.

## Prerequisites

- Admin service running via `pnpm --filter @qzd/admin-web dev -- --host 0.0.0.0`
  or `docker compose up admin-web`.
- API reachable from the browser (default `http://localhost:3000`).
- Access token generated through an admin authentication flow.

## Connect to the API

1. Enter the API base URL if different from the default.
2. Paste a bearer token with admin privileges.
3. Submit **Save connection**. Subsequent requests include the token in the
   `Authorization` header.

## Redeem agent vouchers

1. Open **Voucher redemption**.
2. Paste the voucher code provided by a field agent.
3. Submit to call `POST /agents/vouchers/{code}/redeem`. The UI displays amount,
   fees, timestamps, and metadata returned by the API.
4. Share the confirmation message with the agent if needed.

## Create an issuance request

1. In **Create issuance request**, provide the customer account ID, amount, and
   optional reference memo.
2. Submit to invoke `POST /admin/issuance-requests`. The console clears the form
   and refreshes the queue.
3. Use consistent currency codes (`QZD`, `USD`, etc.) to align with ledger rules.

## Sign issuance requests

1. Choose the validator identity from the dropdown (defaults to `validator-1`).
2. Click **Refresh queue** to load pending items via
   `GET /admin/issuance-requests`.
3. For each request, press **Sign as ...** to call
   `POST /admin/issuance-requests/{id}/sign`. The UI manages idempotency keys.
4. Completed requests disappear once the quorum is met.

## Tips

- Keep the console open while processing requests so the automatic refresh can
  fetch new items after each action.
- Validation errors return detailed messages; surface them in support channels so
  API teams can adjust the OpenAPI contract if needed.
