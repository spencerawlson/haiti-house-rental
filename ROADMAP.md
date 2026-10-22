# Kay Ayiti — Roadmap

Small, reviewable phases, one pull request each. Security and privacy
come first. No phase deletes users or payment history, and none changes
pricing (tenants free; activation 1000 HTG one-time; advertising
75 HTG/month; MonCash/NatCash; admin approval).

Changed in Phase 9: listings are no longer kept forever. A landlord can
delete their own home for good, which also removes its photos from disk
and the conversations and visits about it. It is the one irreversible
action in the app. Payments and reports about a deleted listing are
still kept — money is a ledger, and a moderation trail that a landlord
could erase by deleting the listing would be no trail at all.

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

## Phase 4 — Payments (manual, auditable) ✅

- The landlord submits a MonCash/NatCash reference.
- Payment records move pending → confirmed/rejected, with the reviewing admin and a timestamp.
- Duplicate-reference prevention.
- Advertising start and expiry dates.
- Revenue split into confirmed and pending.
- Nothing is activated without explicit admin approval.

## Phase 5 — UX redesign (mobile-first) ✅ (first pass)

Built against `docs/design/app-showcase.png`; screenshots of the result
are in `docs/design/phase5/`.
- Clean white and blue look (the animated sky background is gone), solid blue buttons, dark mode kept.
- Tab bar Akèy / Rechèch / Favori / Mesaj / Kont, with an unread badge.
- Screen 4 home: logo and bell, search pill, quick chips, department circles, advertised carousel (honestly labeled), newest homes.
- Screen 4 listing cards: heart, blue price, room/WiFi/24h/parking icons, badges.
- Screens 5–6 search: fold-out filters (rent/sale toggle, bedroom chips), list/map toggle, map price pins.
- Screen 7 detail: hero photo with back and heart, sheet layout, fact tiles, sticky "Contact the owner".
- Screen 3 signup: role cards (tenant free / landlord 1,000 HTG once / administrator).
- Screens 11–12 account: profile header, landlord dashboard tiles, menu rows. New pages: My visits, My payments.

Not done yet:
- ~~screen 1 splash and screen 2 onboarding~~ done in Phase 7 (first visit only; see SPEC.md)
- screen 8 gallery room tabs (needs room labels on photos)
- the admin board restyle

Original scope:

Landing, search and filters, cards, detail pages, landlord, tenant and
admin dashboards, chat, appointments, auth screens. Keep the Nunito/pill
identity and full Kreyòl/Français/English coverage.

## Phase 6 — Reliability & operations ✅

- Versioned migrations in `lib/migrations/`, recorded in `schema_migrations`. Each runs in a transaction under an advisory lock. Roll back with `MIGRATE_DOWN_TO`. The baseline `0001` adopts existing databases unchanged.
- `0002 audit_log`: every admin/security action is recorded and shown on the Admin Board.
- Structured JSON logs (`lib/log.js`).
- `/api/health` is a real readiness check: database up and no pending migrations.
- Docker: runs as the non-root `node` user (the entrypoint fixes upload ownership), with a `HEALTHCHECK` and `HOSTNAME` pinned.
- `scripts/backup.sh` and `scripts/restore.sh`, with the runbook in DEPLOY.md.
- `ENVIRONMENT.md` documents every variable.
- CI runs `npm audit --omit=dev --audit-level=high`.

Original scope:

- Versioned, reversible migration files replacing ad-hoc `initDb()` steps.
- Health and readiness checks; basic structured logging.
- Backup and restore runbook for `kayayiti-pgdata` and `kayayiti-uploads`.
- Env-var documentation.
- Capacitor Android/iOS checks, including the pending Gradle 9 wrapper bump.

## Phase 8 — Launch round ✅

- Demo listings hidden from the public (kept in the database; `SHOW_DEMO_LISTINGS=true` for previews). A "just launched" card shows while there are few homes.
- Automatic backups: a `backup` service in docker-compose, at start and every 24 h.
- Notifications:
  - an in-app inbox (bell on Home) for visit requests and answers and payment decisions
  - SMS via Twilio (API key or auth token), optional WhatsApp, email via Resend
  - in the user's language, chat alerts throttled to one per conversation per 15 minutes
  - fire-and-forget, so a failing provider never breaks the app
  - migration `0003` adds the inbox and each account's language
- `.env` is kept out of git and Docker images, and there's a `.env.example` to copy.

## Phase 9 — Landlord control & profiles ✅

- Profile photos: the initials circle on Account is now the file picker
  (`/api/accounts/avatar`, any signed-in account — tenants have a profile
  too and are never "activated"). Images only, 8 MB, 10 changes an hour,
  shrunk in the browser first. The stored value is always a path this
  server wrote, never a URL from the client. Migration `0004`.
- The upload format allowlist and magic-byte check moved to
  `lib/upload-file.js` so the two upload doors share one copy.
- **Delete a listing for good** (`/api/listings/delete`): the row leaves
  the database and its photos leave the disk. "Take down" only hid a
  home, so unwanted listings piled up in the library with no way to
  clear them. Deleting also removes that home's conversations, read
  markers, visits — for the tenant as well as the landlord. It refuses
  while a payment for that home is still pending review, because
  confirming it afterwards would extend advertising on a home that no
  longer exists. A photo shared with another listing is left on disk.
- **View counts**: the landlord sees how many people opened each home
  (`👁 N` in the library). Counted once per viewer per half hour, never
  the owner, by the anonymous `kay-visitor` id rather than by IP —
  Haitian carriers share one address between many subscribers, so
  counting by IP would merge strangers. Never shown publicly. Migration
  `0005`.
- `tests/avatar.test.mjs` and `tests/listings-manage.test.mjs`
  (53 regression tests in total).
