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
| accounts | users; `password_hash` = scrypt over the browser SHA-256 |
| sessions | `sha256(token)`, username, expiry |
| listings | listings; `status` is active or removed (never deleted); `details` JSONB (sanitized); `verified` (admin only) |
| chat_messages | messages; a thread = (`listing_id`, `tenant`) |
| chat_reads, chat_hidden | per-user, per-thread markers |
| visits | visit requests; `proposed_by`, `history` (JSONB, append-only) |
| conversations | id per (`listing_id`, `tenant`), landlord, block state |
| reports | user reports on conversations/listings; open → resolved by admin |
| password_reset_codes | admin-issued one-time reset codes (SHA-256, 24h) |
| payments | submitted MonCash/NatCash references; pending → confirmed/rejected by admin; `events` JSONB audit trail; UNIQUE (provider, reference) |
| revenue_entries | logged activations (incl. manual admin activations before Phase 4) |
| settings | MonCash/NatCash destination numbers |
| migrations | legacy run-once data steps (used inside the 0001 baseline) |
| schema_migrations | applied migration versions (Phase 6) |
| audit_log | admin/security actions: actor, action, target, details |

The schema is managed by versioned migrations in `lib/migrations/`. The
runner (`lib/migrate.js`) applies pending ones at the first query, in
order, each in a transaction under a Postgres advisory lock, and records
them in `schema_migrations`.

- `0001 baseline` is the whole schema up to Phase 5, plus the one-time
  data steps. Those are still guarded by the legacy `migrations` table,
  so they never re-run.
- `0002 audit_log` adds the audit table.
- Rollback: set `MIGRATE_DOWN_TO` (see DEPLOY.md).

## Testing

`tests/unit.test.mjs` needs no server. For the rest, start a throwaway
Postgres and the built app, then:

```
BASE_URL=http://localhost:3000 ADMIN_PASSWORD=<test value> npm test
```

Never point tests at production. They create accounts and listings. The
last test also locks out one test user for 15 minutes.
