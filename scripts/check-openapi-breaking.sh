#!/usr/bin/env bash
set -euo pipefail

BASE_REF="${1:-origin/main}"
SPEC_PATH="openapi/openapi.yaml"

if ! command -v oasdiff >/dev/null 2>&1; then
  echo "Error: oasdiff is required but was not found in PATH." >&2
  echo "Install oasdiff (https://github.com/oasdiff/oasdiff) before running this check." >&2
  exit 1
fi

if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  echo "Fetching $BASE_REF from origin..."
  git fetch origin "${BASE_REF#origin/}" --depth=1 >/dev/null 2>&1 || {
    echo "Error: unable to fetch $BASE_REF" >&2
    exit 1
  }
fi

TMP_BASE_SPEC="$(mktemp)"
trap 'rm -f "$TMP_BASE_SPEC"' EXIT

if ! git show "${BASE_REF}:${SPEC_PATH}" >"$TMP_BASE_SPEC" 2>/dev/null; then
  echo "Error: failed to read ${SPEC_PATH} from ${BASE_REF}." >&2
  exit 1
fi

echo "Checking for breaking OpenAPI changes against ${BASE_REF}..."
set +e
BREAKING_OUTPUT="$(oasdiff breaking --format text "$TMP_BASE_SPEC" "$SPEC_PATH" 2>&1)"
STATUS=$?
set -e

if [ $STATUS -eq 0 ]; then
  if [ -n "$BREAKING_OUTPUT" ]; then
    echo "$BREAKING_OUTPUT"
  else
    echo "No breaking changes detected."
  fi
else
  if [ -n "$BREAKING_OUTPUT" ]; then
    echo "$BREAKING_OUTPUT"
  fi
  echo ""
  echo "Breaking OpenAPI changes detected compared to ${BASE_REF}." >&2
fi

exit $STATUS
