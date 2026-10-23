# Haiti House Rental App — Product Spec (v0)

Live domain (registered 2026-10-21, live the same day):
**kayayiti.app** — served through the existing Cloudflare Tunnel
"domainfolio" (hostname kayayiti.app → http://localhost:8097, Healthy),
container `kayayiti-web` on FedServ host port 8097.

- **Tenant accounts (free):** tenants create an account with full name,
  username, password and phone number — just like landlords, except no
  fee and no admin activation (active immediately). No Gmail login:
  accounts are created in-app. Tenant landing page: `/[locale]/tenants`
  (sign in or create). Sign-in page: `/[locale]/signin` (username +
  password, hashed in the browser).
- **Admin gate:** the Admin Board is password-gated. The password lives
  only in the server env (`ADMIN_PASSWORD`); the cookie holds its hash.
  Without the env var, the admin area stays closed. The full accounts
  list is admin-only too.
- **Deploy:** see `DEPLOY.md` — Docker on FedServ (port 8097) +
  Cloudflare Tunnel for **kayayiti.app**.
- Rent is paid monthly, quarterly, every six months, or yearly. Listings
  carry a rent period; prices display it (e.g. "75,000 HTG pa mwa",
  "225,000 HTG chak 3 mwa"). Sale listings show no period.
- Landing page: `/` is the entry before the full app — hero, language
  switcher, search into the app, department chips, how-it-works. No tab
  bar on the landing; the app lives behind it. Who pays what is spelled
  out per audience in two cards (never one shared line — that confused
  landlords and tenants): tenants free, no fee, no activation; landlords
  one-time 1000 HTG activation via MonCash/NatCash. Background carousel:
  four pale Haiti illustrations (mountains, beach, house, palms) in
  public/images play one after another behind the landing content
  (28s cycle, crossfading, pale white wash over them); all info boxes
  sit on top. Language is chosen in Account -> Settings only (never
  on the landing top right); the choice is remembered in the
  kay_locale cookie, which the landing reads (default Creole). On
  desktop only, the landing top right shows the two NOT-selected
  language codes (KR/FR/EN, space-separated, no backslash): KR picked
  shows FR EN, FR picked shows KR EN, EN picked shows KR FR. Phones
  show nothing on top.
- First visit only (no language saved yet, e.g. first launch of the app):
  the screen-1 splash from docs/design/app-showcase.png asks for the
  language (Kreyòl / Français / English), saves it in kay_locale, and
  continues to a three-slide onboarding (/[locale]/welcome, screen 2).
  Every later visit follows the rule above: language in Account →
  Settings only.
- Mobile apps (Capacitor, one codebase, two apps): Android + iOS,
  appId `com.kayayiti.app`, remote-URL mode loading https://kayayiti.app
  (same pattern as the Farelune app). Icon in `resources/icon.png`,
  CI builds Android AAB/APK in `.github/workflows/build-mobile.yml`;
  iOS builds once Apple signing secrets + Team ID exist. Details in
  `MOBILE.md`. Design direction (2026-10-21): less rigid, Farelune-comfortable
  — rounded Nunito type, pill buttons, rounder/softer cards, warmer text.

## Decisions (from Spencer, 2026-10-21)

- **Launch city:** Port-au-Prince first. **Coverage:** all 10 departments of Haiti
  from day one (Ouest, Nord, Nord-Est, Nord-Ouest, Artibonite, Centre, Sud,
  Sud-Est, Grand'Anse, Nippes) — Cap-Haïtien, Jacmel and every other commune
  are selectable locations, not later additions.
- **Two-sided marketplace:** landlords list homes; tenants search and find
  homes. Tenants browse free.
- **Landlord fees (decided 2026-10-21):** account activation (one-time,
  MonCash/NatCash) **1000 HTG**; advertising **75 HTG/month**,
  admin-approved. Activation is manual: the user transfers from the phone
  number on their account to the admin-set MonCash (Digicel) / NatCash
  (Natcom) destination number, and the admin activates.
- **Payments:** MonCash (Digicel) and NatCash (Natcom) mobile money — NOT
  cash. Flow: landlord pays the fee from their phone number → that phone
  number activates their account → activated account can post listings.
- **Languages:** Haitian Creole, French, and English — all three from launch
  (expats renting in Haiti included).
- **Platform order:** web first, mobile app after (Capacitor-style, same
  pattern as Farelune).
- **Ownership:** assumed Spencer's unless he says otherwise (business-vs-
  client question still open).

## Data model (v0)

- **Listing:** id, title, description, type (house | apartment | land),
  department, commune, priceHTG per month, bedrooms, bathrooms, amenities[],
  photos[], landlordPhone (masked until contact), status (draft | active).
- **Landlord account:** phone number (primary identity), provider (moncash |
  natcash), feePaid (bool), activated (bool).
- **Department list:** all 10 departments with sample communes; Port-au-Prince
  communes (Pétion-Ville, Delmas, Kenscoff, Carrefour, Tabarre) seeded first.

## User flows (v0 → next)

1. Tenant: pick language → pick department/commune → browse listings →
   open listing → contact landlord.
2. Landlord: enter phone number → pick MonCash or NatCash → pay fee
   (placeholder amount) → account activated → post listing with photos.
3. Next steps (not in v0): real MonCash/NatCash payment integration,
   account activation by verified payment, photo uploads, listing
   moderation, tenant accounts, in-app messaging.

## Visits (appointments)

- On every listing, under the chat: a signed-in tenant proposes a date +
  time (+ optional message) to see the home. The listing owner confirms
  or declines from the same listing page (the server checks the caller
  is the owner). The appointment is shared in-app: both sides see it on
  the listing and in Account → My visits, with its status (proposed /
  confirmed / declined). No SMS/email notification yet — that arrives
  with the backend notification phase.

## Chat (owner ↔ tenant)

- Every listing page has a discussion box: a potential tenant writes, the
  owner replies in the same thread. The signed-in account that posted the
  listing replies as the owner; everyone else writes as the tenant. Your
  own messages always sit blue on the right, theirs gray on the left,
  whichever side you are on.
- Threads are private (Phase 1, Oct 2026): one thread per listing +
  tenant, so tenants never see each other's messages; the owner sees one
  thread per tenant. Writing needs a signed-in account, and who is owner
  or tenant comes from the server session (see SECURITY.md). Still
  missing: moderation, block/report, out-of-app notifications.

## Demo listings (decided 2026-10-22)

- The 7 seeded demo listings are hidden from the public: they looked
  like real homes. The rows stay in the database; `SHOW_DEMO_LISTINGS=true`
  shows them for previews. While fewer than 4 real homes exist, the home
  page shows a "just launched — list your home" card instead.

## Pricing (decided 2026-10-21)

- Landlord fees are a SUBSCRIPTION (changed 2026-10-23):
  **1500 HTG** to join, then **1000 HTG every 3 months**. A lapsed quarter
  suspends the account (its homes leave the site); 30 days later it is
  deactivated and coming back costs the joining price again, **1500 HTG**.
  Tenants remain free, and partner accounts never pay.
- Superseded: account activation as a one-time **1000 HTG** fee.
- Advertising (rent or sale): **75 HTG/month**. This buys VISIBILITY, not
  rank: the home appears in the advertised carousel on the home page, with
  its price, where people see it without typing anything. Search order stays
  fair for everyone — every advertiser pays the same price, so no home can
  be "first" (corrected 2026-10-21: the old "put my house first" wording was
  unfair and is gone, from the copy and from the sort).
- Admin-handled: nothing money-related is automatic. A landlord's
  advertising checkbox is only a REQUEST; the admin approves it on the Admin
  page (`/[locale]/admin`), and only approved homes get the 📣 badge and the
  carousel slot. Same for activation: the landlord pays, the admin
  activates the account. Payment collection and account approvals are still
  manual — the app records the prices and the requests, it does not move
  money yet.
- Admin revenue ledger: every landlord activation logs **1000 HTG** (once per
  account; tenant accounts are free and never counted). The Admin page shows
  the running total, the activation roster, and a live HTG → USD / CAD
  converter (rate from open.er-api.com, refreshed hourly; no rate is shown
  if the fetch fails).
- Listings are for rent OR for purchase (purpose field); sale prices show
  as a total, rent as HTG/month.
- Property types: house, apartment, land. Land listings carry an area in
  m² instead of bedrooms/bathrooms, and landlords pick the type on the form.
- Payment destination numbers: the Digicel number for MonCash and the
  Natcom number for NatCash, set from the Admin Board (never hardcoded).
  Signup step 3 and the Account page show the number for the provider the
  user picks, or a "not set yet" note until the admin adds it.
- Accounts (v0, server store): creation asks full name, username, password,
  phone, email, then location (phone GPS with reverse-geocode, or manual
  department/commune pick). Passwords are SHA-256 hashed in the browser;
  the server stores only hashes, never passwords. Activation is manual:
  the user sends 1000 HTG by MonCash or NatCash from the phone number on
  their account, taps "I sent the transfer", and the admin matches the
  transfer to that number and activates the account from /admin. Server
  accounts with bcrypt, cross-device sign-in, and real payment verification
  arrive with the backend. Since the Oct 2026 Postgres migration, accounts
  survive restarts and rebuilds (they used to live in container memory —
  a restart wiped them, which cost a real account on Oct 21).

## Search (Centris-style)

- Search bar on the home page and the listings page (matches commune or
  title, Centris-style).
- Filters: department, property type (house/apartment), price min/max,
  min bedrooms, min bathrooms. Sort: newest, price low→high, high→low.
  Filters live in the URL, so a filtered search is shareable.
- Favorites: heart on every card, saved in the browser (localStorage) until
  accounts exist; a Favorites page lists them.
- Map view: List/Map toggle on the listings page; Leaflet + OpenStreetMap
  pins (free, no key). Seed listings carry approximate commune-center
  coordinates; new listings are geocoded at creation via Nominatim
  (failure = list view only, never a failed post).
- Saved-search alerts: "Save this search" stores the filter in the browser;
  the Alerts page re-runs each saved search against live listings and flags
  listings created after the search was saved as new. Email/push alerts need
  accounts — that's the upgrade path, not a missing piece of the pattern.
- Near me: one tap on "Tou pre'm" asks the phone for location permission,
  then lists homes nearest-first by real Haversine distance, with a radius
  filter and a map centered on the visitor. No typing. Homes without
  coordinates don't appear here (they still appear in list search).

## Photos and videos

- Landlords attach house photos and videos on the posting form
  (`/api/upload`, then `/api/listings`). Detail pages show a photo gallery
  and video players.
- Limits: images 10 MB, videos 100 MB, images and videos only.
- Storage: server disk under `public/uploads/` (git-ignored). Works on a
  persistent server; serverless hosting needs object storage (S3/R2/Spaces).
- v0 limits: no moderation of uploads; posting does NOT yet enforce payment
  activation (arrives with landlord accounts).

## Honest v0 limits

- Listings in v0 are seed/demo data, not real homes.
- The landlord form explains the payment flow but does not move money —
  no payment provider is integrated yet.
- Prices are in HTG per month. No exchange-rate claims.

## Partner accounts + password reset + account IDs (2026-10-21)
- Admin Board "Create partner account": creates a landlord account active
  immediately, free — no fee, no activation queue, never counted in revenue
  (even if later deactivated/reactivated). Password hashed in browser.
- Every account has an assigned id (kay-0001, …) shown in the admin roster
  and on the user's own Account page. Admin Board shows user counts: total,
  live (activated), pending activation.
- Password reset (no email needed): sign-in "Forgot your password?" →
  username + phone number on the account + new password (confirmed). The
  phone check matches with or without +509/spaces. Note: this is v0 — anyone
  who knows a username and its phone number can reset that account.

## Misspelling-tolerant search + landing sign-in (2026-10-21)
- Search ignores accents, hyphens, apostrophes and spaces, and matches
  against title + commune (official + Creole spellings) + department (id +
  all three names). Petionville, Petion-ville, Pétion-Ville, Petyonvil all
  find Pétion-Ville homes; Ouest, West, Lwès all filter to ouest. Saved
  searches use the same matcher. New listings canonicalize a typed commune
  /department to the known spelling on creation (unknown places pass through).
- Landing page now has a sign-in button (top bar) — returning users had no
  way back in from the entry page.

## Live presence (2026-10-21)
- Every open page pings /api/presence once a minute (signed-in users by
  username, others by an anonymous browser id). Admin Board "Live now"
  shows users seen in the last 3 minutes (name, @username, account id) plus
  a count of anonymous visitors browsing, refreshing every 30s. A closed
  tab lingers up to 3 minutes; an idle open tab still counts. Approximate
  by design — it is presence, not exact surveillance.

## Landlord vs tenant roles (2026-10-21)
- Landlords post; tenants explore. The split is now real, not cosmetic:
  /list shows the posting form only to an activated landlord account;
  tenants see a "landlords only" notice with Browse + Create landlord
  account; signed-out visitors see a sign-in notice; inactive landlords
  see their pending-activation notice. The Account page hides "Post home"
  for tenants. POST /api/listings enforces the same rule server-side
  (owner must be an activated landlord, else 403) so a direct API call
  cannot bypass the form. Landlords now also write a description for each
  listing (shown on the detail page).

## Postgres migration (2026-10-21)
- All server data lives in Postgres now (container `kayayiti-db`, volume
  `kayayiti-pgdata`): accounts, listings, chats, visits, revenue, payment
  numbers. Tables are created on first boot; the 7 demo listings seed only
  when the listings table is empty. Restarts and rebuilds keep everything.
  Presence ("Live now") intentionally stays in memory — a restart clearing
  "who is online" is correct behavior. Uploaded photos/videos live on disk
  in the uploads volume, as before.

## Upload serving + real chat (2026-10-21)
- Uploaded photos/videos are served by app/uploads/[file]/route.js,
  which reads the same disk directory the upload route writes to.
  Next's static handler does not serve files added to public/uploads at
  runtime in the standalone server — uploads returned success but their
  URLs 404'd on live, so pictures never displayed. The route fixes old
  and new /uploads/<name> URLs alike (no re-upload needed); traversal
  and unknown extensions 404.
- Chat threads contain only real messages now. The old demo greeting
  (a fake tenant/owner exchange seeded into every thread) is removed:
  new threads start empty, and a one-time boot cleanup deletes stored
  seed rows (exact -m1/-m2 ids, which real messages can never carry).
  The send box no longer clears the draft on failure — a failed send
  shows an error and keeps the text.

## Chat notifications, takedown, edit, library, dark mode (2026-10-21)
- Real chat notifications: every message records its author; a
  per-user, per-thread read marker (chat_reads) tracks what each side
  has seen. The Account tab shows a red unread count (30s refresh),
  Account -> Messages lists each thread with its unread count and last
  message, and opening a listing's chat marks its thread read. Delivery
  itself is the existing 5s poll — near-instant in practice, no push or
  SMS channel exists yet (no email/SMS infra on the app).
- Takedown: the listing owner (from the detail page or Account -> My
  listings) or the admin (Admin Board) can take a listing down. It is
  hidden from home, search and detail pages, but the row and its chats
  and visits stay in the database, so a takedown is reversible.
- Edit: the owner can change every creation field (title, description,
  place, price, rooms/area, purpose, rent period, photos/videos with
  remove + add, advertising request) from the detail page or My
  listings. A changed commune re-geocodes the map pin. Non-owners get a
  notice, and the API enforces owner-or-admin on both edit and takedown.
- Library: /[locale]/library lists every home a landlord ever posted,
  live and taken down, newest first, with status badges and
  View/Edit/Take down (live) or Put back online (taken down) actions.
  Account -> My listings links to it.
- Dark mode: light/dark theme via CSS variables ([data-theme="dark"]
  overrides), a Light/Dark switch in Account -> Settings, and a
  no-flash script in the root layout that applies the stored choice
  (or the system preference when nothing is stored) before first paint.
- Known v0 limit (same as the rest of the app): landlord actions trust
  the username the browser reports for the signed-in user — there is no
  server session yet. Hardening that is a separate step if wanted.

## Per-side chat delete, dedicated chats spot, photo zoom (2026-10-21)
- Delete on your side only: hiding a thread (chat_hidden) removes it
  from that user's inbox and unread counts, but the other side keeps
  it. A message from either side after the hide brings the thread
  back — hiding is not erasing. Delete buttons live on the chats list
  and in Account -> Messages.
- Chats have a dedicated spot: /[locale]/chats shows the thread list
  and opens a conversation there. The listing page's Contact button
  links to /chats?listingId=... (it used to be a dead button), and the
  embedded chat box is gone from listing pages. Account -> Messages
  links point to the chats spot too.
- Tab bar: Chat (💬) sits between Favori and Eksplore, and it carries
  the unread-message badge now (moved off the Account tab).
- Photo zoom: tapping any photo on a listing detail page opens a
  full-screen lightbox — pinch to zoom on touch, scroll to zoom with a
  mouse, + / − / Reset buttons, drag to pan while zoomed, double-tap
  toggles 2×, Escape closes, arrows move between photos.

## Chats list by person (2026-10-21)
- The chats list leads with the other person's first name, taken from
  their account when they are registered: a landlord sees the tenant's
  first name (the most recent registered tenant author in that
  listing's thread), a tenant sees the landlord's first name, and the
  listing title sits below as context. Anonymous writers have no
  account, so their threads fall back to the listing title. Tapping a
  name opens the conversation, whose header shows the same name.
  Account -> Messages uses the same display.
