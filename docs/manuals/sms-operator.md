# SMS Operations Manual

The SMS simulator (`apps/sms-sim`) is a Node.js CLI used to reproduce inbound
messages against the `/sms/inbound` API endpoint. Use it for QA and to verify the
runbook steps for SMS regressions.

## Prerequisites

- Node.js 20 (provided by Docker Compose or your local environment).
- API running and reachable at the base URL you intend to target.

## Launch the simulator

```bash
pnpm --filter @qzd/sms-sim start -- --base http://localhost:3000 --from 5025551000
```

Options:

- `--base` (or `-b`) sets the API base URL. Defaults to `http://localhost:3000`.
- `--from` (or `-f`) configures the MSISDN that will appear in the request body.

## Interactive commands

Once the prompt is active:

- Type an SMS payload (e.g. `BAL` or `SEND 50 5025552222`) and press Enter. The
  CLI issues `POST /sms/inbound` and prints the API reply prefixed with `<<`.
- Use `/from <msisdn>` to change the sender without restarting the process.
- Use `/base <url>` to update the target API URL.
- Use `/quit` or `/exit` to stop the simulator.

## Error handling

- Non-2xx responses surface as `API error <status>: <message>` messages.
- Malformed responses (missing `reply`) raise validation errors so handlers can
  be fixed before shipping to production.

Document repeatable SMS scenarios in this manual so QA can replay them quickly.
