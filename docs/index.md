<script setup lang="ts">
import { withBase } from 'vitepress';
</script>

# QZD MVP Documentation

Welcome to the documentation hub for the QZD minimum viable product. This site
collects reference material for engineers, operators, and stakeholders who run
and extend the platform.

## Table of Contents

[[toc]]

## Platform Overview

- [Architecture](./architecture.md) — high-level services, data flows, and
  integration points.
- [Deployment (Single Server)](./deployment-single-server.md) — run the stack in
  a single machine environment with Docker Compose.
- [Operations Runbook](./runbook.md) — incident response, monitoring, and
  disaster recovery checklists.

## Manuals

- [Wallet User Manual](./manuals/wallet-user.md) — field guidance for wallet
  holders.
- [Admin Operator Manual](./manuals/admin-operator.md) — administrative console
  workflows.
- [Merchant Operator Manual](./manuals/merchant-operator.md) — settlement and
  reconciliation procedures for merchants.
- [SMS Operator Manual](./manuals/sms-operator.md) — running the SMS simulator
  and interacting with the messaging workflows.

## Contributing and API

- [Contributor Guide](./contrib.md) — development environment setup, coding
  standards, and release steps.
- [API Overview](./api-readme.md) — how to interact with the OpenAPI contract
  and generated SDKs.
- Redoc snapshot: open <a :href="withBase('/redoc.html')" target="_blank">redoc.html</a>
  for a static rendering of the OpenAPI specification.
