#!/bin/sh
set -eu

corepack enable pnpm >/dev/null 2>&1

if [ ! -f .pnpm-installed ]; then
  echo 'Installing workspace dependencies with pnpm...'
  pnpm install --frozen-lockfile
  touch .pnpm-installed
fi

exec "$@"
