# Kay Ayiti — Roadmap

Small, reviewable phases, one pull request each. Security and privacy
come first. No phase deletes users or payment history, and none changes
pricing (tenants free; activation 1000 HTG one-time; advertising
75 HTG/month; MonCash/NatCash; admin approval).

Changed in Phase 9: listings are no longer kept forever. A landlord can
delete their own home for good — or tag it sold/leased, which deletes it
automatically after 48 hours — and that removes its photos from disk too.
Chats and visits are NOT deleted: each side owns its own history, so the
landlord leaves the conversation and the tenant keeps every message. It is the one irreversible
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
- **Sold / leased** (`/api/listings/sold`): the landlord tags a home when
  the deal is done. It leaves search immediately — nobody should spend
  mobile data opening a home that is gone — and is deleted for good 48
  hours later (migration `0006`, `sold_at`). Those 48 hours are also the
  undo window: "put back online" clears the tag and cancels the deletion.
  Re-tagging (sold -> leased) does not restart the clock. A home with a
  payment still awaiting review is kept until that is settled. There is
  no scheduler in this app, so the sweep runs from the listing read
  paths, throttled — meaning a home is deleted on the first page view
  after its deadline, never before it.
- **View counts**: the landlord sees how many people opened each home
  (`👁 N` in the library). Counted once per viewer per half hour, never
  the owner, by the anonymous `kay-visitor` id rather than by IP —
  Haitian carriers share one address between many subscribers, so
  counting by IP would merge strangers. Never shown publicly. Migration
  `0005`.
- `tests/avatar.test.mjs`, `tests/listings-manage.test.mjs` and
  `tests/sold-leased.test.mjs` (60 regression tests in total). The
  auto-deletion delay comes from `SOLD_DELETE_AFTER_MS` so the suite can
  use seconds instead of two days; CI sets it, and the sweep test skips
  when it is unset rather than passing without checking anything.

## Phase 10 — Scheduled jobs & visit reminders ✅

- **A real scheduler.** The 48-hour deletion used to run off page traffic,
  so it fired on the first view after the deadline and never on an idle
  site. There is now a `cron` service (`scripts/cron-loop.sh`, the same
  shape as the backup loop) calling `POST /api/cron` every 5 minutes.
  The endpoint is guarded by `CRON_SECRET`, compared in constant time,
  and **fails closed**: with no secret set it answers 503 instead of
  running. Each job is isolated, so one failing does not stop the other,
  and the reply says which failed. The read-path sweep stays as a
  backstop for a deployment that has not configured cron.
- **Visit reminders** (migration `0009`): both sides of a *confirmed*
  visit are nudged two days before, one day before, and on the morning of
  the day (from 06:00 Haiti time). Sent in each person's own language,
  through whichever channels are configured, plus the in-app inbox.
  - Reminders fire in **windows**, not at deadlines, so a visit confirmed
    two hours beforehand gets the morning nudge only instead of all three
    at once — and a reminder whose window has closed is skipped rather
    than arriving absurdly late.
  - Exactly-once comes from the claim in `visit_reminders` (PK per visit
    per kind), taken *before* sending: a crash loses a reminder rather
    than sending a duplicate, which is the right way round when each SMS
    costs money.
  - Rescheduling clears the record, so the new date gets a fresh set.
  - Haiti observes daylight saving, so the offset is read from the date
    rather than hardcoded (tested against January and July).

## Phase 9b — Corrections ✅

- **A tenant no longer loses their chat history** when a landlord deletes
  a home. Deleting used to delete the conversations, which reached into
  the tenant's inbox and erased what they wrote. Now the landlord leaves
  the conversation: it drops out of their inbox, the tenant keeps every
  message and can still read the thread, and nobody can write to it
  again. The thread shows "the landlord is out of the conversation" under
  the last message. Migration `0007` pins `listing_title` and `closed_at`
  onto the conversation so it stands up once the listing row is gone.
  Visits are kept for the same reason — they already carried
  `listing_title`.
- `resolveThread()` now returns `listingId`, so no caller reaches into
  `thread.listing.id` and trips over a deleted listing.
- **A sold/leased home stays on the site** with its tag instead of
  disappearing: people can see that homes actually move here. It takes no
  chat and no visit requests, and the 48-hour deletion countdown is
  **owner-only** — `soldAt`/`deletesAt` are attached in
  `getListingsForOwner()` and never appear in a public response.
- **Admin Board account figures** (migration `0008`): every account card
  now shows last seen, number of logins, average session length, and
  property-visit appointments (total and still-open), with a green dot
  for a session open right now. Presence was in-memory only — a Map that
  prunes after 10 minutes and resets on restart — and session rows are
  deleted on sign-out, so none of this could be answered before. A new
  append-only `login_events` table records it, tied to its session by
  `token_hash` so signing out on one phone does not close the record of a
  session still open on another. Session validation is untouched.
  The board says plainly that the figures start from the day they shipped.
- **Fixed:** the "Mete kay ou" button on the home page's just-launched
  card sent a signed-in landlord to the signup page to make a second
  account. It now goes to `/list`, which already handles all four cases
  (signed out, tenant, awaiting activation, ready).
