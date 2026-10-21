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
  one-time 500 HTG activation via MonCash/NatCash. Background carousel:
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
  MonCash/NatCash) **500 HTG**; advertising **75 HTG/month**,
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
- v0 limits (must be fixed before real use): messages reset on server
  restart; threads are per listing, not per tenant; no moderation, no
  notifications. Production: Postgres threads + messages, auth for both
  sides, moderation and new-message notifications.

## Pricing (decided 2026-10-21)

- Account activation (one-time, MonCash/NatCash): **500 HTG**.
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
- Admin revenue ledger: every landlord activation logs **500 HTG** (once per
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
  the user sends 500 HTG by MonCash or NatCash from the phone number on
  their account, taps "I sent the transfer", and the admin matches the
  transfer to that number and activates the account from /admin. Server
  accounts with bcrypt, cross-device sign-in, and real payment verification
  arrive with the backend. Store is in-memory for now (resets on restart),
  like listings and chat.

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
