#!/bin/sh
# Kay Ayiti restore (Phase 6) — REPLACES the live database (and,
# optionally, the uploads) with a backup made by backup.sh.
#   scripts/restore.sh /var/backups/kayayiti/db-2026-10-22_0300.sql.gz [uploads-....tar.gz]
# Stop the app first so nobody writes during the restore:
#   docker compose stop kayayiti
set -eu
DB_DUMP="${1:?usage: restore.sh <db-dump.sql.gz> [uploads.tar.gz]}"
UPLOADS_TAR="${2:-}"
DB_CONTAINER="${DB_CONTAINER:-kayayiti-db}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-kayayiti_kayayiti-uploads}"

printf 'This REPLACES the live Kay Ayiti database with %s. Type RESTORE to continue: ' "$DB_DUMP"
read -r answer
[ "$answer" = "RESTORE" ] || { echo "Cancelled."; exit 1; }

docker exec "$DB_CONTAINER" psql -U kayayiti -d postgres -c "DROP DATABASE IF EXISTS kayayiti_restore_old;" >/dev/null
docker exec "$DB_CONTAINER" psql -U kayayiti -d postgres -c "ALTER DATABASE kayayiti RENAME TO kayayiti_restore_old;"
docker exec "$DB_CONTAINER" psql -U kayayiti -d postgres -c "CREATE DATABASE kayayiti OWNER kayayiti;"
gzip -dc "$DB_DUMP" | docker exec -i "$DB_CONTAINER" psql -U kayayiti -d kayayiti -v ON_ERROR_STOP=1 >/dev/null
echo "Database restored. The previous one is kept as kayayiti_restore_old until the next restore."

if [ -n "$UPLOADS_TAR" ]; then
  docker run --rm -v "$UPLOADS_VOLUME":/uploads -v "$(cd "$(dirname "$UPLOADS_TAR")" && pwd)":/backup:ro alpine \
    sh -c "tar xzf /backup/$(basename "$UPLOADS_TAR") -C /uploads"
  echo "Uploads restored (existing files with the same name were overwritten; nothing was deleted)."
fi
echo "Now: docker compose start kayayiti && curl -s http://localhost:8097/api/health"
