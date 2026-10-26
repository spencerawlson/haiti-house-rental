#!/bin/sh
# Kay Ayiti restore drill — proves a backup actually restores.
#
# SAFETY: this script NEVER touches the live database (`kayayiti`) or the
# live uploads volume. It works on COPIES of backup files, restores into a
# scratch database named kayayiti_drill_<stamp>, serves it from a scratch
# app container on port 8098, and cleans everything up on `cleanup`.
# It never runs scripts/restore.sh (which REPLACES the live database).
#
# Run on the Docker host, from the repo root (where docker-compose.yml is):
#   scripts/restore-drill.sh run        # set up + verify, leave scratch app up
#   # ... sign in against http://<host>:8098 with a real account ...
#   scripts/restore-drill.sh cleanup <stamp>   # drop scratch DB + files
#
# Output is counts, filenames, sizes, schema numbers and timings ONLY.
# No user data (no phone numbers, chat text, payment details) is printed.
set -u

DB_CONTAINER="${DB_CONTAINER:-kayayiti-db}"
SCRATCH_PORT="${SCRATCH_PORT:-8098}"

die() { echo "restore-drill: ERROR: $*" >&2; exit 1; }

# Postgres password for the scratch app's DATABASE_URL. The live app gets
# it from compose's .env interpolation; the scratch override must use the
# same value, so read it from .env when present, else the compose default.
db_password() {
  if [ -f .env ]; then
    pw="$(grep -E '^POSTGRES_PASSWORD=' .env 2>/dev/null | head -1 | cut -d= -f2-)"
    pw="$(printf '%s' "$pw" | tr -d '"' | tr -d "'")"
    [ -n "$pw" ] && { printf '%s' "$pw"; return; }
  fi
  printf 'kayayiti'
}

cmd_run() {
  [ -f docker-compose.yml ] || die "run from the repo root (docker-compose.yml not found)"
  command -v docker >/dev/null 2>&1 || die "docker not found"
  docker compose version >/dev/null 2>&1 || die "docker compose not found"

  # --- 1. Find the most recent backup pair (never move the originals) ---
  BACKUP_DIR="${BACKUP_DIR:-./backups}"
  if ! ls "$BACKUP_DIR"/db-*.sql.gz >/dev/null 2>&1; then
    if ls /var/backups/kayayiti/db-*.sql.gz >/dev/null 2>&1; then
      BACKUP_DIR="/var/backups/kayayiti"
    else
      die "no db-*.sql.gz found in ./backups or /var/backups/kayayiti"
    fi
  fi
  DB_FILE="$(ls -t "$BACKUP_DIR"/db-*.sql.gz | head -1)"
  UP_FILE="$(ls -t "$BACKUP_DIR"/uploads-*.tar.gz 2>/dev/null | head -1)"
  [ -n "$UP_FILE" ] || die "no uploads-*.tar.gz found in $BACKUP_DIR"
  echo "backup dir: $BACKUP_DIR"
  echo "db backup:   $(basename "$DB_FILE")  size=$(wc -c < "$DB_FILE")  mtime=$(stat -c %y "$DB_FILE" 2>/dev/null || stat -f %Sm "$DB_FILE")"
  echo "uploads:     $(basename "$UP_FILE")  size=$(wc -c < "$UP_FILE")  mtime=$(stat -c %y "$UP_FILE" 2>/dev/null || stat -f %Sm "$UP_FILE")"

  STAMP="$(date +%Y%m%d_%H%M)"
  DRILL="kayayiti_drill_$STAMP"
  SCRATCH="/tmp/kayayiti-drill-$STAMP"
  mkdir -p "$SCRATCH" || die "cannot create $SCRATCH"
  cp "$DB_FILE" "$SCRATCH/" || die "copy of db backup failed"
  cp "$UP_FILE" "$SCRATCH/" || die "copy of uploads backup failed"
  DB_COPY="$SCRATCH/$(basename "$DB_FILE")"
  UP_COPY="$SCRATCH/$(basename "$UP_FILE")"
  echo "scratch dir: $SCRATCH"
  echo "scratch db:  $DRILL"

  T0="$(date +%s)"
  REPORT="$SCRATCH/drill-report.txt"
  {
    echo "Kay Ayiti restore drill — $STAMP"
    echo "backup dir: $BACKUP_DIR"
    echo "db backup: $(basename "$DB_FILE") size=$(wc -c < "$DB_FILE")"
    echo "uploads backup: $(basename "$UP_FILE") size=$(wc -c < "$UP_FILE")"
    echo "scratch db: $DRILL"
  } > "$REPORT"

  docker rm -f kayayiti-drill >/dev/null 2>&1 || true

  # --- 2. Restore the COPY into the scratch database ---
  docker exec "$DB_CONTAINER" psql -U kayayiti -d postgres \
    -c "DROP DATABASE IF EXISTS $DRILL;" \
    -c "CREATE DATABASE $DRILL OWNER kayayiti;" >/dev/null \
    || die "could not create scratch database $DRILL"
  if ! gzip -dc "$DB_COPY" | docker exec -i "$DB_CONTAINER" psql -U kayayiti -d "$DRILL" -v ON_ERROR_STOP=1 >"$SCRATCH/load.log" 2>&1; then
    echo "restore failed; last lines of load log:" >&2
    tail -20 "$SCRATCH/load.log" >&2
    echo "scratch left in place for inspection; clean up with: scripts/restore-drill.sh cleanup $STAMP" >&2
    exit 1
  fi
  echo "database restored into $DRILL"

  # --- 3. Row counts + money-ledger presence (counts only, no row contents) ---
  docker exec -i "$DB_CONTAINER" psql -U kayayiti -d "$DRILL" -t -A <<'SQL' >"$SCRATCH/counts.txt"
SELECT 'accounts', COUNT(*) FROM accounts;
SELECT 'accounts_with_password_hash', COUNT(*) FROM accounts WHERE password_hash IS NOT NULL AND password_hash <> '';
SELECT 'listings', COUNT(*) FROM listings;
SELECT 'payments', COUNT(*) FROM payments;
SELECT 'conversations', COUNT(*) FROM conversations;
SELECT 'visits', COUNT(*) FROM visits;
SELECT 'audit_log', COUNT(*) FROM audit_log;
SELECT 'payment_deletions', COUNT(*) FROM payment_deletions;
SQL
  echo "row counts:"; cat "$SCRATCH/counts.txt"
  cat "$SCRATCH/counts.txt" >> "$REPORT"

  # --- 4. Uploads: extract the COPY to a scratch path, sample photo paths ---
  mkdir -p "$SCRATCH/uploads"
  tar xzf "$UP_COPY" -C "$SCRATCH/uploads" || die "uploads extraction failed"
  docker exec -i "$DB_CONTAINER" psql -U kayayiti -d "$DRILL" -t -A \
    -c "SELECT photos FROM listings WHERE photos IS NOT NULL LIMIT 200;" \
    | grep -o '/uploads/[^"\\,} ]*' | sort -u | head -20 >"$SCRATCH/sample-photos.txt"
  PRESENT=0; MISSING=0
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    if [ -f "$SCRATCH/uploads/${p#/uploads/}" ]; then PRESENT=$((PRESENT + 1)); else MISSING=$((MISSING + 1)); echo "missing: $p"; fi
  done < "$SCRATCH/sample-photos.txt"
  echo "photo sample: $PRESENT present, $MISSING missing (of $(wc -l < "$SCRATCH/sample-photos.txt" | tr -d ' ') sampled paths)"
  echo "photo sample: $PRESENT present, $MISSING missing" >> "$REPORT"

  # --- 5. Serve the restored data from a scratch app container ---
  PW="$(db_password)"
  docker compose run --rm -d --no-deps --name kayayiti-drill \
    -p "$SCRATCH_PORT:3000" \
    -v "$SCRATCH/uploads:/app/public/uploads" \
    -e "DATABASE_URL=postgres://kayayiti:$PW@db:5432/$DRILL" \
    kayayiti >/dev/null || die "could not start scratch app container"
  HEALTH=""; i=0
  while [ "$i" -lt 24 ]; do
    HEALTH="$(curl -s "http://localhost:$SCRATCH_PORT/api/health" || true)"
    case "$HEALTH" in *'"ok":true'*) break;; esac
    sleep 5; i=$((i + 1))
  done
  case "$HEALTH" in *'"ok":true'*) ;; *) echo "scratch app did not report healthy; last response: $HEALTH" >&2; echo "check: docker logs kayayiti-drill" >&2; exit 1;; esac
  T1="$(date +%s)"
  ELAPSED=$((T1 - T0))
  echo "scratch app healthy: $HEALTH"
  echo "recovery time (restore start -> app serving restored data): ${ELAPSED}s ($((ELAPSED / 60))m $((ELAPSED % 60))s)"
  {
    echo "scratch app health: $HEALTH"
    echo "recovery time seconds: $ELAPSED"
  } >> "$REPORT"

  echo ""
  echo "DRILL UP. Sign in at http://localhost:$SCRATCH_PORT (from the LAN: http://<host>:$SCRATCH_PORT)"
  echo "with a real account to complete the sign-in check, then clean up:"
  echo "  scripts/restore-drill.sh cleanup $STAMP"
  echo "Full figures in $REPORT (counts only, no user data)."
}

cmd_cleanup() {
  STAMP="${1:-}"
  if [ -z "$STAMP" ]; then
    echo "available scratch drills:" >&2
    ls -d /tmp/kayayiti-drill-* 2>/dev/null >&2 || echo "  (none)" >&2
    die "usage: scripts/restore-drill.sh cleanup <stamp>"
  fi
  case "$STAMP" in *[!0-9_]*) die "bad stamp: $STAMP";; esac
  DRILL="kayayiti_drill_$STAMP"
  docker rm -f kayayiti-drill >/dev/null 2>&1 || true
  docker exec "$DB_CONTAINER" psql -U kayayiti -d postgres -c "DROP DATABASE IF EXISTS $DRILL;" >/dev/null 2>&1 || true
  rm -rf "/tmp/kayayiti-drill-$STAMP"
  echo "cleaned up: container kayayiti-drill, database $DRILL, /tmp/kayayiti-drill-$STAMP"
}

case "${1:-}" in
  run) cmd_run;;
  cleanup) cmd_cleanup "${2:-}";;
  *) echo "usage: scripts/restore-drill.sh run | cleanup <stamp>"; exit 1;;
esac
