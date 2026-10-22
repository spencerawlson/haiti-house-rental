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
