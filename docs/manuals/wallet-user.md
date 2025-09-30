# Wallet User Manual

The wallet web application (`apps/wallet-web`) helps retail customers manage
QZD accounts. It uses the browser SDK to call the API exposed at
`http://localhost:3000` by default.

## Prerequisites

- Wallet service running via `pnpm --filter @qzd/wallet-web dev -- --host 0.0.0.0` or
  `docker compose up wallet-web`.
- API reachable at the base URL configured in `VITE_API_BASE_URL`.
- An account ID issued by the API or the dev seed script.

## Sign up or sign in

1. Enter the API base URL if you are not targeting the default `http://localhost:3000`.
2. Use **Create account** to register with an email, password, and full name.
   This calls `POST /auth/register` followed by `POST /accounts`.
3. Use **Log in** with the same credentials to request a bearer token via
   `POST /auth/login`. The UI stores the token in memory only.

## Load account data

1. Paste your account ID and submit **Load account**.
2. The UI will fetch the latest balance (`GET /accounts/{id}/balance`) and the
   25 most recent transactions (`GET /accounts/{id}/transactions`).
3. Refresh the section any time with the **Reload** button.

## Send a transfer

1. Load an account and keep the session active (token present).
2. Enter the destination account ID, amount, currency, and optional memo.
3. Submit the form to trigger `POST /tx/transfer`. The UI generates an
   idempotency key automatically and surfaces API errors inline.

## Preview remittance quotes

1. With an account loaded, open the **Preview quote** section.
2. Choose a scenario (Default, Tariffed, Subsidized) and USD sell amount.
3. Submit to call `POST /simulate/quote`. The response includes buy/sell amounts,
   effective rate, and expiration timestamp.

## Troubleshooting

- **401 Unauthorized** – The bearer token may be expired. Log in again.
- **404 Account not found** – Ensure the account ID matches one issued by the API.
- **Transfer stuck** – Check the runbook for `POST /tx/transfer` guidance and
  confirm the memo matches Merchant POS invoices when applicable.
