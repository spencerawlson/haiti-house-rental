#!/bin/sh
# Kay Ayiti backup (Phase 6) — run on the Docker host, e.g. nightly:
#   0 3 * * * /opt/kayayiti/scripts/backup.sh >> /var/log/kayayiti-backup.log 2>&1
#
# Writes to $BACKUP_DIR (default /var/backups/kayayiti):
#   db-YYYY-MM-DD_HHMM.sql.gz       full Postgres dump (accounts, listings,
#                                   chats, visits, payments, audit log)
#   uploads-YYYY-MM-DD_HHMM.tar.gz  every uploaded photo and video
# and deletes backups older than $KEEP_DAYS (default 14).
# Copy the folder off this machine too — a backup on the same disk does
# not survive a dead disk.
set -eu
BACKUP_DIR="${BACKUP_DIR:-/var/backups/kayayiti}"
KEEP_DAYS="${KEEP_DAYS:-14}"
DB_CONTAINER="${DB_CONTAINER:-kayayiti-db}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-kayayiti_kayayiti-uploads}"
STAMP="$(date +%F_%H%M)"
mkdir -p "$BACKUP_DIR"

docker exec "$DB_CONTAINER" pg_dump -U kayayiti -d kayayiti --no-owner | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"
docker run --rm -v "$UPLOADS_VOLUME":/uploads:ro -v "$BACKUP_DIR":/backup alpine \
  tar czf "/backup/uploads-$STAMP.tar.gz" -C /uploads .

# A dump that failed silently is worse than none: check it is not empty.
if [ "$(gzip -dc "$BACKUP_DIR/db-$STAMP.sql.gz" | head -c 1000 | wc -c)" -lt 100 ]; then
  echo "$(date -Is) ERROR: database dump looks empty: $BACKUP_DIR/db-$STAMP.sql.gz" >&2
  exit 1
fi

find "$BACKUP_DIR" -name 'db-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) backup ok: db-$STAMP.sql.gz uploads-$STAMP.tar.gz"
