#!/bin/sh
# Scheduled jobs (runs as the `cron` service in docker-compose.yml).
#
# Calls the app's /api/cron every $CRON_INTERVAL seconds. That endpoint
# does two things: deletes sold/leased homes whose 48 hours are up, and
# sends the visit reminders that are due (two days before, one day
# before, and on the morning of the visit).
#
# Why a loop container and not a timer inside the app: the schedule stays
# visible in docker-compose, and restarting the web app cannot silently
# stop it. Same shape as scripts/backup-loop.sh.
#
# Needs CRON_SECRET to match the app's. Without it the app answers 503,
# and this logs it every cycle rather than failing quietly.
#
# The app logs what each run actually did (cron.ran, with counts), so this
# only reports whether the call got through. The response body is printed
# on its own plain line when something went wrong — not folded into the
# JSON log line, because escaping it portably in BusyBox sh is more
# trouble than it is worth.
set -u
URL="${CRON_URL:-http://kayayiti:3000/api/cron}"
INTERVAL="${CRON_INTERVAL:-300}"
log() { echo "{\"t\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"level\":\"$1\",\"event\":\"$2\"${3:+,$3}}"; }

if [ -z "${CRON_SECRET:-}" ]; then
  log error cron.no_secret '"hint":"set CRON_SECRET in .env next to docker-compose.yml"'
fi

while true; do
  # ONE request per tick: the status code is appended after the body on
  # its own line, so a single call gives both. Calling curl twice would
  # run every job twice.
  # --max-time so a hung request cannot wedge the loop past its tick.
  out="$(curl -sS --max-time 120 -w '\n%{http_code}' \
            -X POST -H "x-cron-key: ${CRON_SECRET:-}" "$URL" 2>&1 || true)"
  code="$(printf '%s' "$out" | tail -n 1)"
  body="$(printf '%s' "$out" | sed '$d')"
  case "$code" in
    200)
      log info cron.ok
      ;;
    503)
      log error cron.disabled '"hint":"CRON_SECRET is not set on the app"'
      ;;
    401)
      log error cron.unauthorized '"hint":"CRON_SECRET does not match the app"'
      ;;
    *)
      log error cron.failed "\"code\":\"$code\""
      printf 'cron.failed body: %s\n' "$(printf '%s' "$body" | head -c 300)"
      ;;
  esac
  sleep "$INTERVAL"
done
