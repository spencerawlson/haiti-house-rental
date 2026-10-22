# Deploy Kay Ayiti to kayayiti.app (FedServ + Cloudflare Tunnel)

## What runs where

- App: Docker container `kayayiti-web`, host port **8097** → container 3000.
- Database: Docker container `kayayiti-db` (Postgres 16), data in the
  `kayayiti-pgdata` volume — accounts, listings, chats, visits, revenue
  and payment numbers survive restarts and rebuilds. The database port is
  NOT published: only the app container can reach it.
- Domain: **kayayiti.app**, on Cloudflare (already on Cloudflare nameservers).
- Tunnel: Cloudflare Tunnel on FedServ routes kayayiti.app → `http://localhost:8097`.
- Old warning, now retired: before Postgres, all data lived in container
  memory and a restart wiped everything. That was the Oct 21 account loss.
  After this migration, a restart or rebuild keeps everything.

## 1. On FedServ — build and run

```sh
mkdir -p /opt/kayayiti && cd /opt/kayayiti
git clone https://github.com/spencerawlson/haiti-house-rental.git
cd haiti-house-rental
export ADMIN_PASSWORD='a-strong-password-you-choose'
docker compose up -d --build
curl -s http://localhost:8097/ht | head -c 200
```

`ADMIN_PASSWORD` is the admin-area password (Admin Board login). It lives
only in the server environment — never in the repo. Without it, the admin
area stays closed.

The first `docker compose up` also starts Postgres (`kayayiti-db`) and the
app creates its tables and seeds the 7 demo listings automatically. Check
the database came up with the app:

```sh
curl -s http://localhost:8097/api/health
# {"ok":true,"db":"up"}
```

To back up the database (do this before any risky change):

```sh
docker compose exec db pg_dump -U kayayiti kayayiti > kayayiti-backup.sql
```

To restore it:

```sh
docker compose exec -T db psql -U kayayiti kayayiti < kayayiti-backup.sql
```

## 2. Cloudflare Tunnel — point the domain at the app

In the Cloudflare dashboard (the kayayiti.app zone):

1. Create (or reuse) a tunnel on the FedServ host (`cloudflared`).
2. Add a public hostname: `kayayiti.app` → `http://localhost:8097`.
3. Wait for DNS to propagate, then open https://kayayiti.app — the
   language picker should appear.

No A record is needed: the tunnel's CNAME is the DNS entry.

## 3. After launch — first checks

1. Create a landlord account, send the 1000 HTG test transfer, activate it
   from the Admin Board (log in with `ADMIN_PASSWORD`).
2. Set the MonCash (Digicel) and NatCash (Natcom) destination numbers on
   the Admin Board.
3. Create a tenant account (free, active immediately) and schedule a test
   visit.

## Updating later

```sh
cd /opt/kayayiti/haiti-house-rental
git pull
docker compose up -d --build
curl -s http://localhost:8097/api/health
```

Data now survives rebuilds (Postgres volume). The one thing a rebuild
still cannot bring back is data created before the Postgres migration —
that lived in container memory and is already gone.

## Upgrading to Phase 1 (server sessions) — one-time notes

1. **Back up first** (the boot migrations rewrite password hashes and chat rows in place):
   `docker exec kayayiti-db pg_dump -U kayayiti kayayiti > kayayiti-$(date +%F).sql`
2. Rebuild and restart as usual. On first boot the app runs two run-once
   migrations, recorded in the `migrations` table:
   - `scrypt-password-hashes`: existing passwords keep working.
   - `chat-per-tenant-threads`: splits shared listing chats into private per-tenant threads.
3. **Everyone signs in once more.** The old browser-only sign-in state cannot
   become a server session; the app clears it automatically and shows Sign in.
4. Nothing new is required in the environment. `ADMIN_PASSWORD` and
   `DATABASE_URL` work as before.

## Upgrading to Phase 1b (admin sessions, reset codes) — one-time notes

1. **The admin signs in again.** Old admin cookies (the static password
   hash) are refused. New admin sessions last 12 hours.
2. **Password resets now go through the admin.** A user who forgot their
   password contacts you. Confirm it's them (call back the phone on the
   account), then click **Password code** on their card on the Admin
   Board and read them the code. It works once, for 24 hours.
3. New, optional environment variables:
   - `ADMIN_SESSION_SECRET`: any long random string. Changing it signs out
     every admin. If unset, only `ADMIN_PASSWORD` keys the tokens.
   - `ALLOWED_ORIGINS`: comma-separated extra origins allowed to POST to
     `/api`. Normally unneeded: kayayiti.app and the Capacitor apps load
     from the same origin.
4. The `password_reset_codes` table is created automatically at boot.

## Upgrading to Phase 4 (payments) — one-time notes

1. New table `payments` and the listing columns `advertised_since` /
   `advertised_until` are created automatically at boot.
2. **New landlord flow:** send the MonCash/NatCash transfer, then enter
   its transaction number on Account (activation) or Library (advertising).
   You confirm it on the Admin Board under "Payments to review", after
   matching the number and amount on your MonCash/NatCash statement.
3. Advertising confirmed through a payment ends on its own when the paid
   months run out. Homes you approved before Phase 4 have no end date and
   stay advertised until you remove them.
4. Manual activation from the accounts list still works (explicit admin
   approval). It shows in revenue as a confirmed activation without a
   payment reference.

## Upgrading to Phase 6 (migrations, audit log, non-root image) — one-time notes

1. **Back up first** (see "Backups" below), as for every upgrade.
2. Rebuild and restart as usual. On first boot the app adopts versioned
   migrations: it creates `schema_migrations`, records `0001 baseline` (no
   changes to your data — every step is "create if missing") and applies
   `0002 audit_log`. Check: `curl -s http://localhost:8097/api/health` →
   `{"ok":true,"schema":"0002","pending":0}`.
3. The container now runs as the unprivileged `node` user. On start it
   hands the uploads folder to that user, so existing photos keep working.
4. `docker ps` now shows `(healthy)` / `(unhealthy)` for `kayayiti-web`.

## Operations runbook

### Health
`GET /api/health` → 200 `{"ok":true,"db":"up","schema":"0002","pending":0}`
only when Postgres answers and every migration is applied; 503 otherwise.
Point an uptime monitor at `https://kayayiti.app/api/health`.

### Logs
One JSON object per line: `docker logs -f kayayiti-web`. Useful filters:
`docker logs kayayiti-web 2>&1 | grep '"level":"error"'` and
`grep '"event":"audit.'`. Admin actions (logins, activations, payment
reviews, verifications, takedowns, reset codes, reading a reported
conversation, payment-number changes) are also kept in the `audit_log`
table and shown on the Admin Board under "Activity log".

### Backups
`scripts/backup.sh` dumps the database and archives the uploads into
`/var/backups/kayayiti`, keeps 14 days, and fails loudly on an empty dump.
Run it nightly from cron on the host:

```sh
0 3 * * * /path/to/haiti-house-rental/scripts/backup.sh >> /var/log/kayayiti-backup.log 2>&1
```

Copy `/var/backups/kayayiti` off the machine as well (another disk,
another server, or cloud storage). **Test a restore at least once.**

### Restore
```sh
docker compose stop kayayiti
scripts/restore.sh /var/backups/kayayiti/db-YYYY-MM-DD_HHMM.sql.gz \
                   /var/backups/kayayiti/uploads-YYYY-MM-DD_HHMM.tar.gz
docker compose start kayayiti
curl -s http://localhost:8097/api/health
```
The restore asks you to type `RESTORE`, keeps the previous database as
`kayayiti_restore_old`, and never deletes upload files.

### Schema migrations
Migrations live in `lib/migrations/` and are applied automatically, in
order, at startup (each in a transaction, under a lock).
- **Add one:** create `lib/migrations/NNNN_name.js` with `version`, `name`,
  `up(db)`, `down(db)`; append it to `lib/migrations/index.js`. Never edit
  a migration that has shipped.
- **Roll back:** set `MIGRATE_DOWN_TO=0001` (the version to return to) in
  `.env`, deploy the older code, restart, then **remove the variable**.
  The baseline `0001` refuses to revert; going further back means
  restoring a backup.
