# Kay Ayiti — Advertising System Assessment

Assessment date: 2026-10-22, against `next-round`.
Status: **assessment only — nothing in this document has been built.**

Findings are labelled **[verified]** (read from this repository) or
**[assumption]** (needs validation nobody did here). No Haitian market
statistics, traffic figures or revenue projections were available for this
assessment, and none have been invented. Where a number matters, this
document says who must measure it.

Decisions already taken by Spencer during the assessment:

- Advertisers pay by **credit card** (they are import retailers buying from
  the US, Canada and France, so they hold cards). Rail: **Stripe**.
- The Stripe entity is **Canadian**.
- Scope: **both** advertiser subscriptions and diaspora-landlord card
  payments, **advertisers first**.

---

## 1. Recommendation

**PROCEED WITH MODIFICATIONS.**

Build a reduced version whose first job is **measurement**, not revenue:
one sponsored slot, exact click counting, admin CRUD, a directory page.
Recruit 3–5 founding advertisers free or near-free for 60–90 days, then
price from real click-through data.

**Do not build** storefront product catalogues, campaign/package entities,
pay-per-click billing, affiliate tracking, or advertiser accounts. Roughly
60% of the originally proposed scope would be rewritten or deleted within
six months.

### Scores

Reasoned judgements, not measurements.

| Dimension | Score | Confidence |
|---|---|---|
| Business viability | 6 / 10 | Low — gated on traffic data nobody has yet |
| Technical feasibility | 7 / 10 | **High** — the reusable inventory was read directly |
| UX compatibility | 7 / 10 | Medium — depends on execution discipline |
| Revenue potential | 6 / 10 | Low — depends on willingness-to-pay validation |
| Operational simplicity | 7 / 10 | High — Stripe automates the costly part |
| Security readiness | 6 / 10 | High — strong base, specific named gaps |

---

## 2. Existing architecture (audit)

All **[verified]**.

| Area | Finding |
|---|---|
| Frontend | Next.js 14.2.35 App Router, React 18.3.1. Server Components by default (`dynamic = 'force-dynamic'` on data pages). No CSS framework — 454 lines of hand-written `app/globals.css` with a coherent class vocabulary. No TypeScript in app code. i18n via `/[locale]/` plus `lib/dictionaries.js`, **1,137 keys across 3 languages**. |
| Backend | No separate backend. **40 Route Handlers** in `app/api/**/route.js`. Data access isolated in `lib/*-server.js`; pure helpers in non-`-server` siblings so client components can import them. |
| Database | Postgres 16 via `pg` Pool, **no ORM**, raw parameterised SQL. 15 tables. `TEXT` ids, `BIGINT` epoch-ms timestamps, `JSONB` for semi-structured data. Versioned migrations under an advisory lock, recorded in `schema_migrations`, reversible via `MIGRATE_DOWN_TO`. **No foreign keys anywhere.** |
| Auth | Two systems. Users: `kay_session` httpOnly cookie, the database stores only `sha256(token)`, and `getSessionAccount()` is the sole identity source. Admin: `kay_admin`, a stateless signed `exp.nonce.HMAC` token, 12h, `SameSite=Strict`, verified in edge middleware with constant-time compares. |
| Roles | `role` is landlord or tenant, plus `activated` and `partner` booleans. **Admin is not an account** — one shared env password. `audit()` records the actor as the literal string `admin`, so admin actions are **not attributable to a person**. |
| Tenant | Free, no activation. **No separate tenant dashboard** — `/[locale]/account` is shared and branches on role. |
| Landlord | 1,000 HTG activation via MonCash/NatCash, submit reference, admin confirms, then may post. |
| Listings | One table, 28 columns. `status` is active or removed, never deleted. `details` JSONB behind a whitelist and sanitiser. Four advertising columns already exist. |
| Search | **In-memory and unpaginated.** `getListings()` selects every active row, then filters and sorts in JS per request with no caching. No `LIMIT`, no `OFFSET`, no full-text index. Text match is substring over title, commune and department only. |
| Geography | 10 departments, **23 hardcoded communes**, trilingual with typo-tolerant resolution. lat/lng geocoded at the **commune centroid, not the address**. **No neighbourhood level exists.** |
| Admin board | A **single 514-line client component**, flat scroll, about 9 sections, no tabs, no pagination, everything fetched in one `load()`. 19 `/api/admin/*` routes, all gated by `middleware.js`. |
| Payments | `lib/payments-server.js` — a well-built manual mobile-money ledger. `UNIQUE (provider, reference)` so one transfer cannot pay twice. Append-only `events` JSONB. Prices read server-side, never from the client. Confirmation is a single conditional `UPDATE ... WHERE status='pending'`, making double-confirm structurally impossible. |
| Analytics | **None.** No impression, click or view tracking of any kind. |
| Deployment | Docker Compose on one host: `db` with no published ports, web on `8097`, nightly backup container. Cloudflare Tunnel to kayayiti.app. Non-root user, HEALTHCHECK, real readiness check. CI builds and tests against a Postgres service container. **42 test cases across 6 files.** |
| Mobile | Capacitor Android/iOS shells in **remote-URL mode** (`server.url` is https://kayayiti.app) — a webview over the live site. No Apple account or store listing yet. |

### The three findings that dominate

1. **"Advertising" already exists here, at 75 HTG/month.** **[verified]**
   `lib/config.js` sets `ADVERTISED_FEE_HTG_MONTH = 75` (about $0.58) for a
   landlord's home in the home-page carousel. The figure is in public UI
   copy in all three languages (`lib/dictionaries.js`). Advertiser tiers of
   $15/$35/$75 are **26x to 130x** that. This is now a **segmentation**
   story (two products, two customers, two currencies, two rails) rather
   than a contradiction — but the answer must be ready when a landlord asks.
2. **You cannot sell an audience you cannot measure.** **[verified]** there
   are no analytics primitives in the repository. This is the single
   largest build gap and the reason measurement precedes monetisation.
3. **The inventory is pre-traction, and the code says so.** **[verified]**
   `app/[locale]/page.js` renders an "early days" banner when
   `LISTINGS.length < 4`, and the seven demo listings are deliberately
   hidden from the public.

### Reusable — the strong part

| Asset | Reuse |
|---|---|
| `lib/payments-server.js` | Add a `kind`. Reference de-duplication, append-only events, admin review and double-confirm safety come free. Biggest single saving. |
| `lib/audit.js` and `audit_log` | One line per ad action, already surfaced on the admin board. |
| `lib/migrate.js` | Transactional, locked, reversible, recorded. |
| `middleware.js` | Anything under `/api/admin/ads` is authenticated and CSRF-guarded with **no new auth work**. |
| `lib/rate-limit.js` | The click endpoint. |
| `lib/upload-file.js` | Format allowlist and magic-byte check (extracted 2026-10-22 for profile photos; ad logos are the third consumer). |
| `components/AdvertisedCarousel.jsx` | Already a sponsored carousel that respects `prefers-reduced-motion`. |
| `.lcard` / `.card` / `.chip` / `.badge` CSS | A sponsored card matches the app's look in about 15 new lines. |
| `lib/departments.js` | Geo-targeting vocabulary, trilingual and typo-tolerant. |
| `lib/listing-details.js` | The whitelist-and-sanitise pattern to copy for advertiser fields. |

### Hard prerequisites

1. **Admin upload door.** Partly addressed: the shared checks now live in
   `lib/upload-file.js` (profile-photo work, 2026-10-22). But `/api/upload`
   still requires `role === 'landlord' && activated`, so the admin cannot
   upload an advertiser logo. An admin-gated door is still needed.
2. **A measurement primitive.** One table. Non-negotiable.
3. **Pagination, or an ad cap.** With no `LIMIT` and every result rendered,
   "an ad every 5 to 6 listings" over 200 results is **33 ads on one page**.
4. **A CSP.** Now required rather than optional — see section 6.
5. **Attributable admin identity**, if a second person ever touches ad money.

---

## 3. Business assessment

**Fit.** Furniture, appliances, mattresses, moving companies and internet
providers are genuinely adjacent to moving house. **Electricians, plumbers
and home security are mostly landlord-side services** in a rental market —
a renter does not hire an electrician for a unit they do not own.
**[verified]** the app's own filters show what tenants care about:
`power24` is a first-class search filter, which makes **inverters, solar
and generators** probably the highest-value Haitian category, and the one
missing from the original list.

**Risk to tenants.** Not annoyance — **bandwidth and trust**. **[verified]**
`lib/image-compress.js` exists *because* Haitian mobile data is expensive;
every ad card is an extra image on the critical path of the user's primary
task. And **[verified]** `SPEC.md` records that "put my house first"
wording was removed as unfair, and `sortListings()` carries a comment
stating advertising must never affect rank. Honest labelling is the
product's differentiator; ads are compatible only if labelled and never
ranked.

**Assumptions requiring validation**, worst first:

- **(a) [assumption] That advertisers have websites to redirect to.** The
  whole model rests on it. Many Haitian SMEs operate on Facebook,
  Instagram and WhatsApp instead. If so, `https://wa.me/509...` and social
  links must be **first-class destinations**, not an afterthought — it
  changes the data model. **Validate before writing code.**
- **(b) [assumption]** Tenant traffic volume and composition. Unmeasurable
  today by anyone.
- **(c) [assumption]** Willingness to pay, and at what price.
- **(d) [assumption]** That advertisers accept self-reported, unaudited
  metrics. Disclose honestly either way.
- **(e) [assumption]** Whether a furniture retailer values a renter 4 to 8
  weeks pre-purchase. Intent here is *adjacent*, not immediate.

**Success thresholds — set before building.** Outbound CTR at or above
0.5%; at least 3 of 5 founding advertisers convert to paying; at least 60%
renew at month two; no measurable drop in listing-detail views or
contact-owner taps; admin time at or under 1 hour per advertiser per month.

**Abandon if**, after 90 days with 3 to 5 live advertisers: CTR is below
about 0.2%, **or** fewer than 2 of 5 will pay anything, **or** admin time
exceeds about 2 hours per advertiser per month, **or** core funnel metrics
drop. Then remove the slots and keep the directory page as a free courtesy.
**The module is designed to be deletable for exactly this reason.**

**Cheapest possible market test, worth running in parallel:** a flat
directory page with ten hand-written entries and no tracking. If five slots
cannot be sold on a static page, they will not sell on a sophisticated one.

---

## 4. Recommended architecture

**(B) An independent module inside the existing application**, plus a
shared Stripe foundation.

**Rejected (C), a separate service:** one container, one Postgres, one
developer, one backup script, one migration chain, no scale pressure. A
second service doubles deployment surface and breaks the single-dump backup
story for no benefit. `ROADMAP.md` already states the project avoids
microservices without demonstrated need, and there is none.

**Rejected (A), diffuse integration:** threading ad logic into
`lib/listings-server.js` would entangle advertising with the core product
and make it hard to remove. Removability is a requirement.

```
lib/migrations/000N_ads.js       advertisers, ad_stats, ad_clicks
                                 (draft: docs/advertising/0005_ads.draft.js)
lib/migrations/000N_currency.js  payments.currency + amount_minor
lib/ads-server.js                ad data access, geo matching, stat writes
lib/ads.js                       URL validation, insertion positions, sanitiser
lib/stripe-server.js             StripeClient instance, Checkout sessions
components/SponsoredCard.jsx     reuses .lcard CSS
app/api/ads/click/route.js       PUBLIC - 302 from the DB-stored URL
app/api/stripe/webhook/route.js  raw body via request.text(), signature verified
app/api/admin/ads/route.js       CRUD, auto-gated by existing middleware
app/[locale]/admin/ads/page.js   separate page, NOT added to the 514-line board
app/[locale]/shops/page.js       public advertiser directory
```

### Three deliberate simplifications

1. **No public read API.** **[verified]** the listings page is a Server
   Component, so it calls `lib/ads-server.js` **directly** — no endpoint,
   no client fetch, no loading state, no extra round-trip on expensive
   mobile data.
2. **One table for advertiser plus placement.** A separate campaigns entity
   only pays off with multiple concurrent creatives per advertiser.
3. **Stripe Customer Portal instead of advertiser accounts.** Advertisers
   update cards and cancel through Stripe's hosted portal. Zero build cost,
   and the original "no advertiser accounts" constraint is honoured.

### The impression problem

**[verified]** listing pages are `force-dynamic`, uncached, on one
Postgres. A naive insert per ad view adds a write to every search render.

**Count clicks exactly, impressions approximately.** Clicks get a row in
`ad_clicks`. Impressions get **one upsert per advertiser per day**, issued
fire-and-forget after the response, following the fail-soft pattern already
used by `geocode()` and `audit()`. Then tell advertisers that impressions
are indicative and clicks are exact — cheaper *and* more honest than a
precise-looking number that cannot be defended.

Also: **cache the active-advertiser list in-process for 60 seconds.**

### Placement rules

- **First ad after position 6, at most one more after position 18, hard cap
  of 2 per render**, enforced in code regardless of result count.
- **Rotate deterministically**, seeded on day plus result-set.
  **[verified]** `force-dynamic` re-renders on every navigation, so
  `Math.random()` would reshuffle ads on every back-button press and
  inflate impressions.
- Full-width in the 2-column `.listing-grid`, so an ad never resembles a
  listing. "Sponsored" must be **real text in the accessible name**, not
  only a visual badge.
- **Never let an ad query failure break the listing page** — try/catch
  returning an empty list.
- Treat pagination as a **separate** improvement. Worth doing for Haitian
  bandwidth on its own merits; do not couple the ad launch to it.

### Storefronts: defer

Not in the first release. The premise is "we do not process purchases, we
redirect", so a storefront is an **intermediate page between the ad and the
store** — an extra click, extra images on expensive data, duplicating what
the advertiser's own site does better, and (see section 6) possibly
inheriting consumer-protection responsibility for republished prices.

Instead: one **directory page** `/[locale]/shops` — logo, name, category,
service area, "Visit Store". No product entities. Advertisers get a durable
link they can point their own customers at.

### Geographic targeting

Existing data is **sufficient at commune and department level, and nothing
finer**. Derive the tenant's location from the **search filter already in
the URL**, never from device geolocation — no new permission prompt, no
location storage, no privacy surface. Fallback order: commune, then
department, then national, then render nothing.

---

## 5. Payments

**Advertisers: Stripe, card, USD. Haitian landlords: MonCash/NatCash, HTG.
Diaspora landlords: Stripe, card, USD.**

**[verified — stripe.com/global, fetched 2026-10-22]** Stripe supports
merchants in 50+ countries; in the Americas: US, Canada, Mexico, Brazil.
**Haiti is not supported and is not in preview.** Paying with a card
requires nothing of the payer's country; *receiving* requires a
supported-country entity. The entity here is **Canadian**, so Stripe is
viable.

**Charge in USD, not CAD.** Haitian importers price inventory in USD; a CAD
figure on a card statement is a support ticket. Stripe Canada settles USD
charges to a CAD account with a conversion fee of roughly 2%. **Worth
asking the bank:** a Canadian USD business account can receive USD payouts
and avoid the conversion entirely.

**Use hosted Checkout, not Payment Element.** No Stripe.js on the pages, so
no CSP surgery for frame, script and connect directives; minimal PCI scope;
and a redirect-out-and-back flow is already this app's idiom.

### Business model

**Model A, a flat subscription,** is the recommendation.

- **Model B, pay per click: reject.** **[verified]** `SECURITY.md` records
  that Haitian carriers put many subscribers behind shared CGNAT
  addresses, which **destroys IP-based click de-duplication** — the click
  count cannot be defended. Variable bills also erode trust at this scale.
- **Model C, affiliate: reject.** Requires merchant cooperation, APIs and
  checkout-side attribution that **[assumption]** most Haitian SMEs in
  these categories cannot provide.

**Founding-advertiser period:** 3 to 5 advertisers, free or token price,
60 to 90 days, in exchange for permission to publish anonymised results.
This is the only way to price honestly. With Stripe, prices can be changed
and advertisers can self-serve cancel, so **launching at a hypothesis price
is low-risk** — ship a price, instrument it, adjust.

**Offer quarterly billing.** **[verified]** `AD_MONTH_OPTIONS = [1,3,6,12]`
and a correct `addMonths()` already exist. Fewer collection events means
less admin time, which is the binding constraint.

**One tier at launch.** Tiers need features to differentiate them.

### Currency in the schema — a silent-bug risk

**[verified]** every money column is HTG-only integer:
`payments.amount_htg`, `revenue_entries.amount_htg`, and
`paymentSummary()` **sums `amount_htg` across all rows**. Insert a USD card
payment and the revenue total **silently becomes meaningless** — adding
2,500 (HTG) to 35 (USD) and displaying the sum. Nothing errors; the number
is just wrong.

Required before any card payment is recorded: a `currency` column plus
`amount_minor`, and `paymentSummary()` reworked to **group by** currency
rather than sum across it. Keep `amount_htg` populated for existing rows.
Store the **presentment** currency, and do **not** model settlement FX in
Postgres — reconcile payouts in Stripe's dashboard.

### Webhooks are mandatory, not optional

Lifecycle: `checkout.session.completed`, `invoice.paid`,
`invoice.payment_failed`, `customer.subscription.updated`,
`customer.subscription.deleted`.

Risk, also required for production: `charge.dispute.created`,
`charge.refunded`, `radar.early_fraud_warning.created`. Business rule: a
dispute or refund **deactivates the placement**. Resolve events through
Stripe's object graph to the Subscription, then map to local rows; use
metadata only as an explicit fallback.

Implementation notes:

- The webhook route must read `await request.text()`. **`request.json()`
  breaks signature verification** — a classic App Router trap.
- **[verified] the CSRF middleware needs no change.** `sameSite()` returns
  true when there is no `Origin` header, and Stripe sends none.
- Use a **restricted key** (`rk_` prefix), not a secret key, in the
  existing env pattern (`.env` at `chmod 600`, documented in
  `ENVIRONMENT.md`).
- Use `stripe sandbox create` for dev and CI; separate keys per environment.
- **New risk class:** chargebacks. Mobile money had no dispute mechanism.
  Card fees of roughly 2.9% plus 30 cents mean a $15 subscription nets
  about $14.15.

### Tax — requires an accountant

Not legal or tax advice. These are the questions to ask:

- Is the business over the GST/HST **small-supplier threshold**? Confirm the
  current figure.
- Are advertising services to a **non-resident Haitian business**
  zero-rated exports? Likely, but confirm.
- **The subtlety that affects the schema:** a diaspora landlord **resident
  in Canada** paying a Canadian entity is a **domestic** supply, so GST/HST
  likely applies. A US-resident landlord is an export. A Haitian landlord
  paying by MonCash is an export. **Tax treatment varies by customer
  country**, so customer country must be captured at checkout. Hosted
  Checkout collects billing address — but only if asked.
- **Do not enable `automatic_tax` without an active registration.** Stripe
  collects zero tax and returns no error while the dashboard reads "on".

### Diaspora landlords may be the stronger half

**[verified]** activation today requires a MonCash/NatCash transfer **from
the phone number on the account** (`SPEC.md`, `lib/payments-server.js`),
matched by hand. A landlord in Brooklyn or Montreal plausibly has **no
MonCash account and no Haitian mobile number**. The current flow does not
merely inconvenience diaspora owners — **it structurally excludes them.**
Card payment unblocks a segment rather than adding convenience, and the
Stripe work is about 90% shared with advertisers.

### Capacitor webview

**[verified]** `capacitor.config.ts` sets `server.url` to
https://kayayiti.app; both shells are webviews over the live site, and no
Apple account exists yet.

- **Technical, certain:** Checkout inside a webview degrades — 3DS
  redirects, Apple Pay, Google Pay and Link all misbehave. **Open Checkout
  in the system browser** and let the webhook update status on return.
- **Policy, moderate:** Apple requires In-App Purchase for unlocking
  in-app features. A landlord activation fee is far more defensible as a
  *physical-world service* (the carve-out Zillow and Airbnb operate under),
  and it does not touch advertisers at all, since they are admin-created
  and never log in. Not a showstopper, but cheap to design around now
  rather than discover at review. The system-browser flow mitigates both
  problems at once.

---

## 6. Security and privacy

| # | Area | Control |
|---|---|---|
| 1 | Admin auth | **[verified] already strong.** Set `ADMIN_SESSION_SECRET` in production (supported, currently optional). |
| 2 | RBAC | `/api/admin/ads` is gated automatically. No new mechanism. |
| 3 | Server-side authz | Prices and status from the server, never the client — the `payments-server.js` pattern. |
| 4 | File upload | Magic-byte and format allowlist already correct, now shared in `lib/upload-file.js`. Keep the allowlist to exactly what `/uploads/[file]` serves — **no SVG**, it is an XSS vector. Needs an admin-gated door. |
| 5 | External URLs | **https only** (plus `wa.me` or `whatsapp:` if supported); reject `javascript:`, `data:`, `vbscript:`; normalise on write; **re-validate at render**. |
| 6 | Stored XSS | React escapes by default, and **[verified]** the one raw-HTML sink was already fixed. Never `dangerouslySetInnerHTML` for advertiser content. Reuse the `sanitizeDetails` whitelist pattern. **Add a CSP** — Stripe's own guidance requires one for any app loading Stripe assets, and ad content is exactly what it protects. |
| 7 | SQL injection | **[verified] already handled.** Note that `updateListing()` builds dynamic SQL from a **hardcoded column whitelist** — the pattern to copy. |
| 8 | Rate limiting | Reuse `rateLimit()` on the click endpoint. **[verified] ceiling:** in-memory, single container. |
| 9 | **Click fraud** | **Cannot be solved, must be disclosed.** **[verified]** CGNAT breaks IP de-duplication. Mitigate: de-dupe per session, advertiser and hour; drop bot user-agents; exclude the admin's own clicks. Tell advertisers the numbers are indicative. |
| 10 | Analytics privacy | **Store no IPs, no user-agents, no account ids, no fingerprints** in ad tables. Coarse geo from the search filter is enough and keeps privacy exposure low at zero cost. |
| 11 | Audit logging | Reuse `audit()`. **[verified] caveat:** the actor is the literal string `admin`, so actions are not attributable to a person. Fix before a second operator touches ad money. |
| 12 | Database integrity | **[verified]** the existing schema has **no foreign keys at all**. The ad tables are new, so use real FKs with `ON DELETE RESTRICT`. |
| 13 | Campaign manipulation | Admin-only writes plus audit trail. |
| 14 | Advertiser impersonation | Low while every advertiser is hand-created. Becomes real with advertiser accounts — another reason to defer them. |
| 15 | **Malicious redirects** | **Highest-severity new risk.** The click endpoint takes an **ad id** and resolves the destination **from the database**. Never accept a URL parameter — that is an open redirect usable for phishing under your own domain. Render links with `target="_blank" rel="noopener noreferrer nofollow sponsored"`. The `nofollow sponsored` pair is also required SEO correctness for paid links. |

### Legal questions requiring professional review

No compliance claim is made here. These need Haitian counsel, and Canadian
counsel for the entity:

- **Data protection:** Haiti's framework for personal-data processing, and
  whether coarse ad analytics triggers any obligation.
- **Advertising disclosure:** required labelling for paid placement. A
  "Sponsored" label is good practice regardless, but sufficiency is not
  asserted here.
- **Consumer protection:** republishing an advertiser's prices and product
  descriptions may carry responsibility for their accuracy — **a concrete
  argument for deferring storefronts.**
- **Commercial:** advertising contracts, payment terms, liability for
  advertiser conduct, and the right to refuse or remove an advertiser.
- **Tax:** see section 5.

---

## 7. Performance and UX

- **Images:** require small admin uploads (the browser-side discipline in
  `lib/image-compress.js` is the model). For 5 to 20 logos, hand-sized
  uploads are sufficient — **skip `sharp`**; a native binary in the image
  is not worth it at this scale.
- **Lazy loading:** `loading="lazy" decoding="async"`, as `ListingCard`
  already does.
- **Caching:** **[verified]** `/uploads/[file]` already sets
  `Cache-Control: immutable, max-age=31536000`. Add the 60-second
  in-process advertiser cache.
- **Queries:** one query per render for all ads, never one per card.
- **Accessibility:** the sponsored label belongs in the accessible name.
  The carousel's existing `prefers-reduced-motion` handling is the
  precedent to follow.

---

## 8. MVP and roadmap

### Essential

1. `advertisers`, `ad_stats`, `ad_clicks` (draft:
   `docs/advertising/0005_ads.draft.js`)
2. `lib/ads-server.js` and `lib/ads.js`
3. Admin-gated upload door
4. `/[locale]/admin/ads` — create, edit, activate, deactivate, dates,
   coverage, one stats column
5. `GET /api/ads/click` — 302 from the database plus counter upsert
6. `components/SponsoredCard.jsx` and capped insertion
7. `/[locale]/shops` directory
8. Trilingual strings for new UI labels only. **Advertiser-supplied copy is
   never translated** — label the directory accordingly.
9. CSP, URL validation, `rel="noopener noreferrer nofollow sponsored"`,
   audit entries
10. `tests/ads.test.mjs`

### Postpone

Storefront pages, product entities, packages and tiers, campaign
priorities, pause and resume (deactivate covers it), invoices, renewal
records, geographic performance reports, CTR dashboards, expiry automation.

### Never build

Advertiser self-serve accounts, PPC billing, affiliate tracking, a separate
ad service, real-time analytics, ad auctions, per-user frequency capping.

### Phases

| Phase | Scope | Effort |
|---|---|---|
| 9a | Ad foundation — schema, admin CRUD, admin upload, click redirect, `/shops` | 2-3 d |
| 9b | Placement — capped sponsored card, geo match, daily-aggregate impressions | 2-3 d |
| 9c | **Stripe foundation** — SDK, hosted Checkout, webhooks, currency migration, CSP, sandbox and CI keys | 3-4 d |
| 9d | Advertiser subscriptions and Customer Portal | 1-2 d |
| 9e | Diaspora landlord card activation, system-browser flow | 1-2 d |

**Total about 9 to 14 developer-days, plus or minus 50%.** Low because the
payments ledger, migration runner, admin gate, audit trail and card CSS
already exist. Unknowns: the admin upload door, CSP rollout (**[verified]**
`next.config.js` notes the inline theme script and Leaflet will fight a
strict policy), and trilingual copy review.

**Before charging any advertiser: 9a plus 9b plus 9c plus 9d**, plus the
honest-metrics disclosure. 9c should follow 9b so the first renewal
conversation has a real number in it.

---

## 9. Unresolved questions

1. **Is landlord advertising at 75 HTG underpriced, or are the advertiser
   tiers overpriced?** Everything commercial depends on the answer.
2. Do ads show to **everyone browsing** (signed-out visitors and landlords
   included, so more reach but less precise) or only to signed-in tenants?
   **[verified]** the browsing surface is shared, so this is a deliberate
   choice, not a detail.
3. Does `/[locale]/shops` go in the `TabBar`? That is prime real estate
   currently spent on core function.
4. Who operates this when Spencer is unavailable, and does that require
   real admin accounts?
5. Will honest CTR be published to advertisers even when it is
   unflattering?
6. Can an advertiser be refused or removed, and on what stated grounds?
