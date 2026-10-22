#!/bin/sh
# Automatic backups (runs as the `backup` service in docker-compose.yml).
# Backs up once at start — so every deploy gets a fresh backup — then
# every 24 hours: a Postgres dump and an archive of the uploads, kept
# for $KEEP_DAYS days in /backups (./backups on the host by default).
# Copy that folder off the server too; same-disk backups die with the disk.
set -u
KEEP_DAYS="${KEEP_DAYS:-14}"
log() { echo "{\"t\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"level\":\"$1\",\"event\":\"$2\"${3:+,$3}}"; }

backup_once() {
  stamp="$(date -u +%F_%H%M)"
  db="/backups/db-$stamp.sql.gz"
  up="/backups/uploads-$stamp.tar.gz"
  if ! pg_dump -h db -U kayayiti -d kayayiti --no-owner | gzip > "$db.tmp"; then
    rm -f "$db.tmp"; log error backup.db_failed; return 1
  fi
  if [ "$(gzip -dc "$db.tmp" | head -c 1000 | wc -c)" -lt 100 ]; then
    rm -f "$db.tmp"; log error backup.db_empty; return 1
  fi
  mv "$db.tmp" "$db"
  tar czf "$up.tmp" -C /uploads . && mv "$up.tmp" "$up" || { rm -f "$up.tmp"; log error backup.uploads_failed; }
  find /backups -name 'db-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
  find /backups -name 'uploads-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
  log info backup.ok "\"db\":\"$(basename "$db")\",\"bytes\":$(wc -c < "$db")"
}

mkdir -p /backups
while true; do
  backup_once
  sleep 86400
done
