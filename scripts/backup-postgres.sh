#!/usr/bin/env bash
# Daily Postgres backup for PingMe. Safe for root cron on the VPS.
# Usage:
#   BACKUP_DIR=/var/backups/pingme ./scripts/backup-postgres.sh
# Cron example:
#   0 3 * * * BACKUP_DIR=/var/backups/pingme /var/www/sites/pingme/scripts/backup-postgres.sh >> /var/log/pingme-backup.log 2>&1
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/pingme}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
CONTAINER="${POSTGRES_CONTAINER:-pingme-postgres}"
PG_USER="${POSTGRES_USER:-pingme}"
PG_DB="${POSTGRES_DB:-pingme}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT_FILE="${BACKUP_DIR}/pingme-${STAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

if [[ -n "${DATABASE_URL:-}" ]] && command -v pg_dump >/dev/null 2>&1; then
  pg_dump "${DATABASE_URL}" | gzip -c > "${OUT_FILE}"
elif docker ps --format '{{.Names}}' | grep -qx "${CONTAINER}"; then
  docker exec "${CONTAINER}" pg_dump -U "${PG_USER}" "${PG_DB}" | gzip -c > "${OUT_FILE}"
else
  echo "error: set DATABASE_URL (with pg_dump) or ensure container ${CONTAINER} is running" >&2
  exit 1
fi

find "${BACKUP_DIR}" -type f -name 'pingme-*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete

echo "wrote ${OUT_FILE}"
