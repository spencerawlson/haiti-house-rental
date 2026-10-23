# Kay Ayiti — Environment variables

Set these in the `.env` file next to `docker-compose.yml` on the server,
never in the repo.

| Variable | Required | Used by | What it does |
|----------|----------|---------|--------------|
| `ADMIN_PASSWORD` | **yes** | app | Admin Board password. If unset, the admin area stays closed. It also keys admin sessions, so changing it signs every admin out. Use a long random value. |
| `POSTGRES_PASSWORD` | **yes** (prod) | db + app | Postgres password. Compose builds `DATABASE_URL` from it. The default `kayayiti` is for local use only. |
| `DATABASE_URL` | set by compose | app | Postgres connection string. Only set it yourself outside Compose. |
| `ADMIN_SESSION_SECRET` | no | app | Extra key mixed into admin session tokens. Changing it signs every admin out without changing the password. |
| `ALLOWED_ORIGINS` | no | app | Comma-separated extra origins allowed to POST to `/api` (CSRF guard). kayayiti.app and the Capacitor apps don't need it. |
| `SHOW_DEMO_LISTINGS` | no | app | `true` shows the 7 seeded demo listings (previews only). Unset in production: demos stay hidden. |
| `CRON_SECRET` | **for scheduled jobs** | app + cron | Shared secret for `POST /api/cron`, which sends visit reminders and deletes sold/leased homes whose 48 h are up. Unset = the endpoint answers 503 and nothing is scheduled. Generate with `openssl rand -hex 32`; must match on both services. |
| `CRON_INTERVAL` | no | cron | Seconds between scheduled runs. Default 300 (5 min). |
| `BILLING_QUARTER_MS` | no | app | Length of a paid quarter. Default: 3 **calendar** months. Only the regression tests set it (to a few seconds) — leave unset in production. |
| `BILLING_DUE_REMINDER_MS` | no | app | How early the "payment due soon" reminder goes out. Default 7 days. Test-only; shorten it alongside `BILLING_QUARTER_MS` or every account looks permanently due. |
| `BILLING_GRACE_MS` | no | app | How long a suspended account has before deactivation. Default 30 days. Test-only, as above. |
| `SOLD_DELETE_AFTER_MS` | no | app | How long a home marked sold/leased waits before it is deleted for good. Default 48 h. Only the regression tests set it (to a few seconds) — leave it unset in production. |
| `BACKUP_DIR` | no | backup service | Host folder for automatic backups (default `./backups`). |
| `BACKUP_KEEP_DAYS` | no | backup service | Days to keep backups (default 14). |
| `MIGRATE_DOWN_TO` | no — rollback only | app | Set to a migration version (e.g. `0001`), then restart. Every newer migration is reverted. **Unset it afterwards.** |
| `NODE_ENV` | set by image | app | `production` in the image: cookies are `Secure`. |
| `PORT` / `HOSTNAME` | set by image | app | `3000` / `0.0.0.0`. Compose maps host port 8097 to 3000. |

Backup script variables (`scripts/backup.sh`, `scripts/restore.sh`):

| Variable | Default | Notes |
|----------|---------|-------|
| `BACKUP_DIR` | `/var/backups/kayayiti` | Copy it off the machine too. |
| `KEEP_DAYS` | `14` | Older backups are deleted. |
| `DB_CONTAINER` | `kayayiti-db` | |
| `UPLOADS_VOLUME` | `kayayiti_kayayiti-uploads` | Compose prefixes the folder name. Check with `docker volume ls \| grep uploads`. |

Tests (`npm test`, never against production):

| Variable | Notes |
|----------|-------|
| `BASE_URL` | URL of a running app with a throwaway database. |
| `ADMIN_PASSWORD` | The same value that app was started with. |

Notifications (optional; with none set, only the in-app inbox works and nothing is spent):

| Variable | Channel | Notes |
|----------|---------|-------|
| `TWILIO_ACCOUNT_SID` | SMS / WhatsApp | Always needed (starts with `AC`), from the Twilio console. |
| `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET` | SMS / WhatsApp | **Recommended**: an API key (`SK…`) and its secret, which can be revoked on its own. |
| `TWILIO_AUTH_TOKEN` | SMS / WhatsApp | Alternative to the API key: the account's main Auth Token. |
| `TWILIO_SMS_FROM` | SMS | A Twilio number that can text Haiti (+509). |
| `TWILIO_WHATSAPP_FROM` | WhatsApp | A WhatsApp-enabled sender, e.g. `+14155238886` (sandbox). WhatsApp only delivers free text inside a 24 h conversation; otherwise an approved template is required. Used instead of SMS when set. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email | e.g. `EMAIL_FROM="Kay Ayiti <no-reply@kayayiti.app>"`, from a domain verified in Resend. |
| `PUBLIC_BASE_URL` | all | Link base in messages (default `https://kayayiti.app`). |
