# syntax=docker/dockerfile:1.5
FROM node:20-alpine AS base
WORKDIR /workspace
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache libc6-compat python3 make g++ \
  && corepack enable

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY apps/merchant-pos/package.json apps/merchant-pos/package.json
COPY apps/sms-sim/package.json apps/sms-sim/package.json
COPY apps/wallet-web/package.json apps/wallet-web/package.json
COPY packages/card-mock/package.json packages/card-mock/package.json
COPY packages/ledger/package.json packages/ledger/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/sdk-api/package.json packages/sdk-api/package.json
COPY packages/sdk-browser/package.json packages/sdk-browser/package.json
COPY packages/sdk-node/package.json packages/sdk-node/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN pnpm --filter @qzd/merchant-pos build

FROM nginx:1.25-alpine
COPY apps/merchant-pos/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/merchant-pos/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - http://127.0.0.1/healthz || exit 1
