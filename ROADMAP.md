# Kay Ayiti — Roadmap

Small, reviewable phases, one pull request each. Security and privacy
come first. No phase deletes users, listings, chats, visits, uploads or
payment history, and none changes pricing (tenants free; activation
1000 HTG one-time; advertising 75 HTG/month; MonCash/NatCash; admin
approval).

## Phase 1 — Sessions, authorization, private chats ✅ (this PR)

- Server-managed httpOnly sessions; identity never read from request bodies.
- Salted scrypt over the existing browser hash, migrated without lockout.
- Signup can no longer self-grant partner/activated status.
- Phones and emails hidden from public lookups.
- Visits private to the two sides; per-tenant chat threads (migrated).
- Rate limits on auth, chat and upload.
- Uploads limited to activated landlords and served formats.
- Map-popup XSS fixed.
- `tests/auth.test.mjs` (14 regression tests), AUDIT.md, SECURITY.md.

## Phase 1b — Remaining hardening ✅

- Admin sessions: signed 12h token per login (HMAC, edge-verifiable), constant-time compare, sign-out (AUDIT #10).
- Password recovery: admin-assisted reset (admin issues a one-time code the user enters), then SMS/WhatsApp code when a channel exists (AUDIT #11).
- Origin check on state-changing requests (AUDIT #12).
- Next.js 14.2.5 → 14.2.35; evaluate 15 later (AUDIT #13).
- Magic-byte check on uploads (AUDIT #15).
- Web CI: build plus regression tests against a Postgres service container.
- Security headers (nosniff, frame deny, referrer policy).

## Phase 2 — Conversations & appointments ✅

- `conversations` table: stable id per (listing, tenant), landlord, block state; backfilled for existing threads.
- Block (either side; only the blocker unblocks; messages kept) and report in chat.
- Report a listing; admin reports queue with moderator access to the reported conversation, takedown and resolve.
- Visits:
  - server-checked dates and times (Haiti time, today to 180 days, 06:00–20:00 on the half hour)
  - the side that didn't propose confirms
  - cancel, and reschedule by either side
  - append-only history
  - one active request per tenant per home
- UI follows the design showcase: screen 9 (chat) and screen 10 (calendar + time slots).

## Phase 3 — Listings ✅

- Structured optional details stored as sanitized JSON (`lib/listing-details.js`): water, electricity, 24/7 power, internet, furnished, security, amenities, parking, availability date, conditions, extra fees. Shown as screen-7 tiles on the detail page.
- Photos shrunk in the browser before upload (≤1600 px JPEG, usually 200–500 KB); HEIC is converted where the browser can decode it. Card images lazy-load.
- Admin verification badge (a manual check with a confirmation prompt; never automatic, and landlords can't set it).
- **Ordering bug fixed:** search used to `reverse()` the server order, putting the oldest demo houses first and new real listings last. It's now newest real listings first, with stable ties. Advertising never affects ranking.
- Search filters: 24/7 power, furnished, verified.
- Indexes on `listings (status, created_at)` and `(owner)`.
- Detail page shows the department name, not its raw ID.
- `tests/unit.test.mjs` (no server needed) and `tests/phase3.test.mjs`.

Still open: responsive image sizes (several widths per photo) and a photo gallery with room tabs (screen 8).

## Phase 4 — Payments (manual, auditable)

- The landlord submits a MonCash/NatCash reference.
- Payment records move pending → confirmed/rejected, with the reviewing admin and a timestamp.
- Duplicate-reference prevention.
- Advertising start and expiry dates.
- Revenue split into confirmed and pending.
- Nothing is activated without explicit admin approval.

## Phase 5 — UX redesign (mobile-first)

Landing, search and filters, cards, detail pages, landlord, tenant and
admin dashboards, chat, appointments, auth screens. Keep the Nunito/pill
identity and full Kreyòl/Français/English coverage.

## Phase 6 — Reliability & operations

- Versioned, reversible migration files replacing ad-hoc `initDb()` steps.
- Health and readiness checks; basic structured logging.
- Backup and restore runbook for `kayayiti-pgdata` and `kayayiti-uploads`.
- Env-var documentation.
- Capacitor Android/iOS checks, including the pending Gradle 9 wrapper bump.
