# Haiti House Rental App — Product Spec (v0)

## Decisions (from Spencer, 2026-10-21)

- **Launch city:** Port-au-Prince first. **Coverage:** all 10 departments of Haiti
  from day one (Ouest, Nord, Nord-Est, Nord-Ouest, Artibonite, Centre, Sud,
  Sud-Est, Grand'Anse, Nippes) — Cap-Haïtien, Jacmel and every other commune
  are selectable locations, not later additions.
- **Two-sided marketplace:** landlords list homes; tenants search and find
  homes. Tenants browse free.
- **Landlord fee:** a small listing fee, amount TBD — still in discussion with
  people on the ground. The fee is a **placeholder** (`LISTING_FEE` in
  `lib/config.js`); it must never ship as a final number until Spencer
  confirms it.
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

## Chat (owner ↔ tenant)

- Every listing page has a discussion box: a potential tenant writes, the
  owner replies. v0: one thread per listing, messages in server memory,
  tenant-side sending live, owner side seeded.
- v0 limits (must be fixed before real use): messages reset on server
  restart; threads are per listing, not per tenant; no accounts, so owner
  replies need landlord accounts + login; no moderation, no notifications.
  Production: Postgres threads + messages, auth for both sides, moderation
  and new-message notifications.

## Pricing (decided 2026-10-21)

- Account activation (one-time, MonCash/NatCash): **1000 HTG**.
- Featured placement (house shown first, rent or sale): **75 HTG/month**.
- Admin-handled: nothing money-related is automatic. A landlord's featured
  checkbox is only a REQUEST; the admin approves it on the Admin page
  (`/[locale]/admin`), and only approved homes get the badge and sort first.
  Same for activation: the landlord pays, the admin activates the account.
  Payment collection and account approvals are still manual — the app records
  the prices and the requests, it does not move money yet.
- Listings are for rent OR for purchase (purpose field); sale prices show
  as a total, rent as HTG/month.
- Property types: house, apartment, land. Land listings carry an area in
  m² instead of bedrooms/bathrooms, and landlords pick the type on the form.

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
- Near me: one tap on "Toupre m" asks the phone for location permission,
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
