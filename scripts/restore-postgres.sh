#!/usr/bin/env bash
# Restore a PingMe Postgres dump. Requires explicit CONFIRM=1.
# Usage:
#   CONFIRM=1 ./scripts/restore-postgres.sh /var/backups/pingme/pingme-YYYYMMDD-HHMMSS.sql.gz
set -euo pipefail

DUMP_FILE="${1:-}"
CONTAINER="${POSTGRES_CONTAINER:-pingme-postgres}"
PG_USER="${POSTGRES_USER:-pingme}"
PG_DB="${POSTGRES_DB:-pingme}"

if [[ -z "${DUMP_FILE}" ]]; then
  echo "usage: CONFIRM=1 $0 <path-to-pingme-*.sql.gz>" >&2
  exit 1
fi

if [[ "${CONFIRM:-}" != "1" ]]; then
  echo "Refusing to restore without CONFIRM=1 (this overwrites database ${PG_DB})." >&2
  exit 1
fi

if [[ ! -f "${DUMP_FILE}" ]]; then
  echo "error: dump not found: ${DUMP_FILE}" >&2
  exit 1
fi

if [[ -n "${DATABASE_URL:-}" ]] && command -v psql >/dev/null 2>&1; then
  gunzip -c "${DUMP_FILE}" | psql "${DATABASE_URL}"
elif docker ps --format '{{.Names}}' | grep -qx "${CONTAINER}"; then
  gunzip -c "${DUMP_FILE}" | docker exec -i "${CONTAINER}" psql -U "${PG_USER}" -d "${PG_DB}"
else
  echo "error: set DATABASE_URL (with psql) or ensure container ${CONTAINER} is running" >&2
  exit 1
fi

echo "restored ${DUMP_FILE} into ${PG_DB}"
