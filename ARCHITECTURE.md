# Kay Ayiti — Architecture

## Runtime

- **Web:** Next.js 14 App Router, built as a standalone server (`Dockerfile`).
- **Hosting:** container `kayayiti-web` (host port 8097), served at
  kayayiti.app through a Cloudflare Tunnel.
- **Database:** Postgres 16 (`kayayiti-db`, volume `kayayiti-pgdata`).
  It is only reachable on the compose network.
- **Uploads:** stored on disk in volume `kayayiti-uploads`
  (`/app/public/uploads`) and served by `app/uploads/[file]/route.js`.
- **Mobile:** Capacitor Android/iOS shells that load https://kayayiti.app
  in remote-URL mode (`MOBILE.md`).

## Layout

```
app/[locale]/…        pages (ht | fr | en), client components
app/api/…             route handlers (JSON)
components/           shared UI (ChatBox, ListingMap, TabBar, …)
lib/*-server.js       server-only data access (Postgres via lib/db.js)
lib/session-server.js session cookie ↔ account (identity for every API)
lib/migrate.js        versioned migration runner; lib/migrations/ holds them
lib/log.js, lib/audit.js  JSON logs; audit trail of admin actions
scripts/              backup.sh / restore.sh (run on the Docker host)
lib/password.js       scrypt hashing
lib/rate-limit.js     in-memory limiter
lib/chat-auth.js      who is owner/tenant on a thread
lib/listing-details.js allowed detail fields + sanitizer (client-safe)
lib/billing-server.js  the landlord subscription lifecycle and its sweep
lib/reminders-server.js visit reminders (2 days / 1 day / morning) and the
                      Haiti-time window logic they fire in
app/api/cron/         the scheduled job: due deletions + due reminders,
                      guarded by CRON_SECRET (fail closed)
scripts/cron-loop.sh  the `cron` service calls /api/cron every 5 min
lib/listings-server.js sweepSoldListings() — deletes sold/leased homes
                      whose 48 h are up. Driven by the scheduled job; the
                      read-path call is only a backstop.
lib/image-compress.js browser-side photo shrink before upload
lib/account.js        browser helpers (sign-in, signup, session hint)
lib/dictionaries.js   all UI strings in three languages
middleware.js         admin gate (/api/admin/*, admin page, accounts list)
tests/                regression tests run against a live instance
```

## Request identity

```
browser ──cookie kay_session──▶ route ──getSessionAccount()──▶ sessions ⋈ accounts
                                   └── permissions decided from that account only
admin pages/APIs ──cookie kay_admin──▶ middleware (isAdminCookie)
```

## Data

| Table | Holds |
|-------|-------|
| accounts | users; `password_hash` = scrypt over the browser SHA-256; `avatar_url` = optional profile photo (an `/uploads/` path this server wrote); `billing_status` / `paid_until` / `suspended_at` = the landlord subscription (`paid_until` NULL = never expires: tenants and partners) |
| sessions | `sha256(token)`, username, expiry |
| listings | listings; `status` is active, removed, sold or leased; `sold_at` starts the 48 h auto-deletion; `details` JSONB (sanitized); `verified` (admin only); `views` (owner-only count). The owner can delete one for good — row, photos, chats and visits all go (`/api/listings/delete`) |
| chat_messages | messages; a thread = (`listing_id`, `tenant`) |
| chat_reads, chat_hidden | per-user, per-thread markers |
| visits | visit requests; `proposed_by`, `history` (JSONB, append-only) |
| conversations | id per (`listing_id`, `tenant`), landlord, block state, `listing_title` + `closed_at` so a thread outlives its listing |
| reports | user reports on conversations/listings; open → resolved by admin |
| password_reset_codes | admin-issued one-time reset codes (SHA-256, 24h) |
| payments | submitted MonCash/NatCash references; pending → confirmed/rejected by admin; `events` JSONB audit trail; UNIQUE (provider, reference) |
| revenue_entries | logged activations (incl. manual admin activations before Phase 4) |
| settings | MonCash/NatCash destination numbers |
| migrations | legacy run-once data steps (used inside the 0001 baseline) |
| schema_migrations | applied migration versions (Phase 6) |
| audit_log | admin/security actions: actor, action, target, details |
| billing_reminders | which subscription warnings have gone out: PK (`username`, `period_end`, `kind`) is the claim that makes the job safe to re-run |
| visit_reminders | which reminders have gone out: PK (`visit_id`, `kind`) is the claim that makes the job safe to re-run |
| login_events | one row per sign-in (tied to its session by `token_hash`): `at`, `last_seen_at`, `ended_at`. Feeds the Admin Board's per-account figures. Append-only; never consulted for authorization |
| traffic_visitors | one row per visitor per Haiti day: PK (`day`, `visitor`) is what makes a once-a-minute heartbeat count as one visitor. Signed-in people key on `u:<username>`, everyone else on the anonymous id — never on IP, which on Haitian carriers merges strangers |
| metrics_daily | daily rollups that cannot be recomputed after the fact: PK (`day`, `metric`). `subs_active` is a level snapshotted by cron; the churn counters are incremented by the billing sweep, the only moment those events exist. Signups, new subscribers and revenue are NOT here — they are derived live from `accounts` and `payments`, which already have the dates |
| payment_deletions | the permanent record of every deleted transaction: the whole row, plus who deleted it and a reason that a `CHECK` constraint makes mandatory. Nothing in the app removes from this table, and migration `0013`'s `down()` does not drop it |

The schema is managed by versioned migrations in `lib/migrations/`. The
runner (`lib/migrate.js`) applies pending ones at the first query, in
order, each in a transaction under a Postgres advisory lock, and records
them in `schema_migrations`.

- `0001 baseline` is the whole schema up to Phase 5, plus the one-time
  data steps. Those are still guarded by the legacy `migrations` table,
  so they never re-run.
- `0002 audit_log` adds the audit table.
- `0004 profile_photo` adds `accounts.avatar_url`.
- `0005 listing_views` adds `listings.views`.
- `0006 sold_leased` adds `listings.sold_at` and its index.
- `0007 conversation_survives` adds `conversations.listing_title` and
  `closed_at`, so a tenant keeps a thread after the home is deleted.
- `0008 login_events` adds the login-history table behind the Admin
  Board's account figures (last seen, logins, average session).
- `0009 visit_reminders` adds the sent-reminder claims table.
- `0010 quarterly_billing` turns the landlord fee into a subscription and
  grandfathers existing payers with a full quarter.
- `0011 billing_reminders` adds the "payment due soon" claims table.
- `0012 traffic_metrics` adds `traffic_visitors` and `metrics_daily` for
  the Admin Board's traffic reports, plus indexes on `accounts.created_at`
  and `payments (status, reviewed_at)` for the series derived live.
- `0013 payment_deletions` adds `payments.sender_phone` (the number the
  transfer came from, which replaced the typed-in transaction id) and the
  permanent deletion record. Its `down()` drops the column but
  deliberately NOT the record table.
- Rollback: set `MIGRATE_DOWN_TO` (see DEPLOY.md). Note that rolling back
  past `0013` leaves `payment_deletions` in place, on purpose.

## Testing

`tests/unit.test.mjs` needs no server. For the rest, start a throwaway
Postgres and the built app, then:

```
BASE_URL=http://localhost:3000 ADMIN_PASSWORD=<test value> npm test
```

Never point tests at production. They create accounts and listings. The
last test also locks out one test user for 15 minutes.
