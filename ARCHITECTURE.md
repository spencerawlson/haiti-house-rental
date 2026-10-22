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
lib/password.js       scrypt hashing
lib/rate-limit.js     in-memory limiter
lib/chat-auth.js      who is owner/tenant on a thread
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
| listings | listings; `status` is active or removed (never deleted) |
| chat_messages | messages; a thread = (`listing_id`, `tenant`) |
| chat_reads, chat_hidden | per-user, per-thread markers |
| visits | visit requests |
| revenue_entries | logged activations |
| settings | MonCash/NatCash destination numbers |
| migrations | names of run-once data migrations already applied |

The schema is created and evolved at boot by `initDb()` with idempotent
DDL. One-time data changes run through `runOnce()` and are recorded in
`migrations`. Reversible, versioned migration files are planned for
Phase 6 (`ROADMAP.md`).

## Testing

Start a throwaway Postgres and the built app, then:

```
BASE_URL=http://localhost:3000 ADMIN_PASSWORD=<test value> npm test
```

Never point tests at production. They create accounts and listings. The
last test also locks out one test user for 15 minutes.
