# Kay Ayiti — Roadmap

Small, reviewable phases, one pull request each. Security and privacy
come first. No phase deletes users or payment history, and none changes
pricing (tenants free; activation 1,500 HTG to join + 1,000 HTG every 3 months; advertising
100–1,000 HTG chosen by the landlord; MonCash/NatCash; admin approval).

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

Still open: responsive image sizes (several widths per photo). The photo
gallery with room tabs (screen 8) shipped in Phase 12.

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
- ~~screen 8 gallery room tabs~~ done in Phase 12
- ~~the admin board restyle~~ done in Phase 12, tabbed in Phase 13

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

## Phase 11 — Landlord subscription ✅

The one-time activation fee became a quarterly subscription (migration
`0010`): **1500 HTG** to join, **1000 HTG** every 3 calendar months,
suspension when a quarter lapses, deactivation 30 days after that, and
**1500 HTG** to come back.

- `billing_status` is pending | active | suspended | deactivated, with
  `paid_until` and `suspended_at`. `paid_until` NULL means "never
  expires" — tenants (free) and partner accounts.
- **`activated` stays the single gate for "may post"**, kept in step with
  the subscription. Every existing permission check already reads it, so
  suspension enforces itself through code that is already tested instead
  of a second rule nobody remembers.
- **Suspension has teeth:** a lapsed landlord's homes leave search AND
  stop resolving by direct link. They stay in the landlord's own library,
  and chats and visits keep working, so paying brings everything back and
  nobody loses a conversation over a late payment.
- The server decides what is owed (`dueKindFor`), so a landlord cannot
  pay the cheaper quarter when the joining fee is due. Prices come from
  config, never from the client.
- Time is only ever ADDED from the later of now and `paid_until`: paying
  early never loses days bought, paying late never back-dates a quarter.
- Transitions run from the scheduled job added in Phase 10.
- `/api/admin/billing` lets the admin override a status (goodwill, or
  fixing a mistake), audited.
- **Grandfathering:** landlords who already paid the old one-time fee get
  a full quarter from the migration, not from their original activation.
- **A week's warning before the quarter ends** (migration `0011`): the
  suspension notice used to be the first a landlord heard of it, by which
  point their homes had already left the site. The warning names the
  amount and the date, and is sent once per billing period — the claim in
  `billing_reminders` is what stops a five-minute job becoming a
  five-minute reminder. Renewing earns a fresh warning for the new
  period. The job warns before it sweeps, so an account on the edge is
  never warned and suspended in the same run.

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

## Phase 10b — Signed-in state in the chrome ✅

- **Fixed:** the landing page offered "Konekte" to somebody who was
  already signed in, sending them to a sign-in form for the account they
  were using. It is a server component, so the real session is checked
  there and the button becomes "Kont" (→ Account). A stale or forged
  session cookie falls back to "Konekte" rather than a dead link.
- The Account tab shows the signed-in person's **profile photo**, with
  the outline avatar as the placeholder when signed out or when no photo
  is set (and if the image 404s). The photo rides along on the
  `/api/presence` reply, which already had the account row loaded, and is
  cached in the `kay-session` hint — so no page pays for an extra request
  to render the tab bar. Uploading or removing a photo updates the tab
  immediately instead of waiting for the next ping.

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

## Phase 12 — Gallery & Admin Board restyle ✅

- Photo gallery with room tabs (design screen 8): photos are labelled
  inside / outside / surroundings and the detail page groups them under
  tabs. The labels are sanitized server-side against an allowlist and the
  URLs against `/uploads/<file>`, so neither a room name nor an off-site
  image can be injected through them.
- The Admin Board restyle: summary tiles, section chips, section headers.
- `tests/journeys.mjs`: end-to-end tenant and landlord journeys, safe to
  run against production because every account and listing it creates is
  labelled `qa_`/"QA test". Opt-in (`--yes-production`) and not run by CI.

## Phase 13 — Admin tabs, traffic reports, transaction deletion ✅

The board was one long page that loaded every account on every visit. At
a thousand users that is slow; at a hundred thousand it does not render.

- **Users is its own tab** (`components/AdminUsers.jsx`), searched,
  filtered and paged in Postgres (`listServerAccountsPage`). Search covers
  name, username, account id, phone and email; filters cover role and
  subscription status; `per` is capped at 100 so a hand-written
  `?per=100000` cannot ask for the old behaviour back. The panel fetches
  only when the tab is opened.
- **The engagement figures are scoped to the page.** `getAccountMetrics()`
  used to aggregate every login event and every visit in the database to
  answer a question about the twenty-five rows on screen; it now takes a
  list of usernames, and passing none returns nothing rather than
  everything.
- **Live-now no longer scans the account table.** It looked up each live
  user with `.find()` over every account — on a route polled every 30
  seconds.
- **Traffic reports** (migration `0012`), daily / weekly / monthly, with
  CSV download. Six series: visitors, signups, new and returning
  subscribers, suspensions, deactivations, and revenue by kind.
  - **Flows sum, stocks do not.** Visitors and revenue add up over a week;
    "active subscribers" is a level, so the report shows where it ended. A
    week of forty active subscribers is forty, not two hundred and eighty.
  - **A visitor is a person, not a request.** One row per visitor per
    Haiti day, claimed with `ON CONFLICT DO NOTHING`, so the once-a-minute
    heartbeat from an open tab cannot inflate it. Signed-in people count
    by account, so a phone and a laptop are one visitor. Never by IP:
    Haitian carriers put many subscribers behind one address.
  - **Only what cannot be recomputed is stored.** Signups, new subscribers
    and revenue are derived live from `accounts.created_at` and the
    payment ledger, so those reports have full history. Visitors and the
    active/churn series had no source and begin at the deploy — the same
    honest limit the account figures carry, and the board says so on
    screen.
  - The CSV is rendered from the same report object the screen uses, so a
    download cannot disagree with the page.
- **The transfer is identified by phone number, not a transaction ID**
  (migration `0013`). The landlord is asked for the number they sent the
  money from, which is what the admin matches against the MonCash/NatCash
  statement. It is a new column, not a reuse of `reference`: that carries
  `UNIQUE (provider, reference)`, so a phone number in it would have
  rejected every landlord's second payment from the same phone — every
  renewal. `reference` is now generated server-side.
  - Consequence worth knowing: "one transfer pays once" is gone as a
    database rule, because a phone number is not a one-time token. What
    stops a double submission is the one-pending-payment-per-account
    guard.
- **Transactions can be deleted, and the deletion is a permanent record.**
  A test payment sitting in confirmed revenue is a lie about the money, so
  it has to be removable — but a deletion that leaves no trace is worse.
  Deleting copies the whole row into `payment_deletions` with who did it
  and **a mandatory reason**, and only then takes the row out.
  - Mandatory is a `CHECK` constraint as well as a prompt: a rule enforced
    only at the edge is a rule the next caller skips.
  - Nothing in the app clears that table — no route, no helper, no button
    — and the migration's `down()` deliberately leaves it in place,
    breaking the usual reversibility rule on purpose. A rollback must not
    become a way to erase the record of what was erased.
  - Deleting a confirmed payment does move the revenue figures. It does
    not reverse what the payment did: an account it activated stays
    activated, and advertising it paid for keeps running.
- `tests/traffic.test.mjs` (17 tests) plus deletion tests in
  `tests/phase4.test.mjs`. Because test files run concurrently against one
  server, the traffic tests assert properties that survive concurrency —
  ten pings are not ten visitors; a flow total equals the sum of its own
  rows — rather than exact global counts.
- **Fixed in the test suite:** every file signed in as admin separately,
  which sat exactly on the admin login limit (10 per 15 minutes), so
  adding one more file made the whole suite fail on a 429.
  `adminClient()` now shares one session across the suite.
- Kreyòl wording: the featured-homes section is "Kay vedèt yo" rather than
  "Kay an piblisite".

## Phase 14a — Offline shell & installable PWA ✅

First slice of low-connectivity resilience. Smallest and safest piece:
the app stops showing a dead white screen when the network drops, and it
becomes a real installable app. Caching of listings/photos/API data is
deliberately left to 14b so a stale cache can never hide a changed price.

- **Service worker** (`public/sw.js`, registered by
  `components/ServiceWorkerRegister.jsx` in the root layout). It precaches a
  self-contained offline page and only intercepts **fresh navigations**
  (cold open, refresh, address bar): if one can't reach the network it
  serves `public/offline.html` instead of a blank screen. Everything else —
  API, `_next`, uploads, Next's soft client-side navigations — goes
  straight to the network, unchanged.
- **Offline page** (`public/offline.html`): inline styles only, so it never
  depends on a stylesheet or font that might not be cached; dark-mode aware;
  the message is in Kreyòl, French and English with a retry button.
- **Installable manifest**: `public/manifest.webmanifest` gained `name`,
  `start_url` (`/ht`), `scope`, `display: standalone`, `theme_color` and
  `background_color` (`#bae6fd`, matching the native splash), and its icon
  types were corrected from `image/png` to `image/webp`. Linked from the
  root layout's `metadata.manifest`.
- **Update safety:** a new worker is not swapped in under the user — the
  page shows a small "Mete ajou" prompt that activates it on tap. `/sw.js`
  is served `no-cache` (`next.config.js`) so a fix always propagates, and a
  one-paste kill switch is documented in `MOBILE.md`.
- Works inside both Capacitor shells (Android WebView / iOS WKWebView over
  the https remote URL).
- `tests/offline.test.mjs`: `/sw.js` is served as uncached JavaScript (never
  `immutable`), `/offline.html` carries the offline message, and the
  manifest is complete enough to install.

Still open: **14b** (cache-first `_next`/photos, stale-while-revalidate
listings feed, network-first navigations with a cached fallback) and
**14c** (queue-and-retry a chat message / visit request made offline).

## Phase 14b — Cache what costs data ✅

Builds on 14a's worker (`public/sw.js`, `VERSION` → `v2`). Repeat visits
now transfer almost nothing and already-seen pages open with no signal. The
strategies are chosen so a stale copy can never mislead:

- **`/_next/static/*` — cache-first.** Build-hashed filenames, so a cached
  copy is byte-identical to the network's forever. The biggest repeat-visit
  win (all JS/CSS/fonts).
- **`/uploads/...?w=` — cache-first, capped at ~60 (oldest evicted).** Only
  the resized photo thumbnails the cards and galleries request; full-size
  originals, videos and voice notes are deliberately left to the network so
  the cache can't balloon on a cheap phone. A resized URL always names the
  same bytes, so cache-first is safe.
- **`GET /api/listings` (no query) — stale-while-revalidate.** The public
  feed renders instantly from cache and refreshes behind it. Only the bare
  feed: the owner (`?owner=&all=1`), detail/viewer (`?id=`) and admin
  variants all carry a query string and go straight to the network, so no
  personalised or signed-in data is ever cached.
- **Navigations — network-first**, falling back offline to the last good
  copy of that page, then the offline page. Pages that can carry signed-in
  content (`/account`, `/admin*`, `/library`, `/chats`, `/payments`,
  `/visits`, auth) are never stored, so a shared phone can't surface a
  cached private page.
- Everything else — API writes, admin, auth, upload originals — is left to
  the network untouched.

The service-worker caching can't be exercised by the node test harness (it
needs a browser), so it is verified manually (DevTools → Offline, Lighthouse
PWA, and the native shells in airplane mode); the checklist is in
`MOBILE.md`. 14a's `tests/offline.test.mjs` still guards that the worker,
offline page and manifest are served.

Still open: **14c** (queue-and-retry a chat message / visit request made
offline).
