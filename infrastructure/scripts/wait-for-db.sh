#!/usr/bin/env bash
set -euo pipefail

HOST="${1:-localhost}"
PORT="${2:-5432}"
MAX_ATTEMPTS="${3:-30}"
SLEEP_SECONDS="${4:-2}"

echo "Waiting for PostgreSQL at ${HOST}:${PORT}..."

for ((i = 1; i <= MAX_ATTEMPTS; i++)); do
  if pg_isready -h "$HOST" -p "$PORT" -U pingme -d pingme >/dev/null 2>&1; then
    echo "PostgreSQL is ready."
    exit 0
  fi
  echo "Attempt ${i}/${MAX_ATTEMPTS} — not ready yet..."
  sleep "$SLEEP_SECONDS"
done

echo "PostgreSQL did not become ready in time."
exit 1
