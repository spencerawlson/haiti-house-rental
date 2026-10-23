# Kay Ayiti — Security Design

## Identity: server sessions

- Sign-in (`/api/accounts/signin`) and signup (`/api/accounts`) set
  `kay_session`: 32 random bytes, `HttpOnly; SameSite=Lax; Path=/`,
  `Secure` in production, 30-day expiry.
- The `sessions` table stores only `sha256(token)`, the username and the
  expiry. Expired rows are purged at boot.
- `getSessionAccount(request)` (`lib/session-server.js`) is the **only**
  source of "who is calling". Usernames, owners, tenants, authors or
  senders in a request body or query are never trusted for authorization.
- Sign-out deletes the session row. A password reset deletes every session
  of that account.
- The browser keeps a `kay-session` localStorage hint (`{ username }`) only
  to render owner-only buttons quickly. It grants nothing. `/api/presence`
  and `/api/accounts/me` correct it when the server session is gone.

## Admin sessions

- `kay_admin` is a signed token `<expiry>.<nonce>.<HMAC-SHA256>`, made
  fresh at each login. It expires after 12 hours and is set with
  `HttpOnly; SameSite=Strict`, plus `Secure` in production.
- The HMAC key comes from `ADMIN_PASSWORD`, plus `ADMIN_SESSION_SECRET` if
  set. Changing either one revokes every admin session.
- Middleware verifies the token on the edge runtime (Web Crypto, no
  database). All comparisons are constant-time. Admin login is limited to
  10 tries per 15 minutes per IP. The board has a sign-out button.

## Password recovery (admin-assisted)

1. The user contacts Kay Ayiti.
2. The admin confirms who they are, e.g. by calling back the phone on the
   account.
3. The admin clicks **Password code** on the Admin Board. That issues a
   one-time code: 10 characters, about 50 bits, stored only as SHA-256,
   valid 24 hours, and a new code replaces the old one.
4. The user enters username + code + new password on Forgot password.
5. The code is used up, and every session of the account is revoked.

Username + phone alone no longer resets anything.

## CSRF

The middleware refuses any non-GET `/api` request whose `Origin` host
isn't this site, or whose `Sec-Fetch-Site` is `cross-site`. Allowed hosts:
`Host`, `X-Forwarded-Host`, and the optional `ALLOWED_ORIGINS` list.
Requests without `Origin` (non-browser clients) pass, and SameSite
cookies cover old browsers.

## Headers

Every response carries:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (geolocation for this site only)

A nonce-based CSP is still to do.

## Passwords

- The browser sends `sha256(password)`. The server stores
  `scrypt$<salt>$<hash>` of that value (`lib/password.js`, 16-byte salt,
  64-byte key) and compares in constant time.
- Migration `scrypt-password-hashes` wrapped every pre-existing hash once,
  so existing passwords keep working.

## Authorization rules

| Action | Who |
|--------|-----|
| Post a listing, upload media | Activated landlord (session) |
| Edit / take down / restore a listing | Its owner (session) or admin |
| Mark a listing sold / leased | Its owner (session) or admin. Only those two values are accepted, so this endpoint cannot be used to set an arbitrary status. The home stays listed with its tag but takes no chat or visits; deletion is scheduled in 48 h; undone by restore until then. The countdown (`soldAt`/`deletesAt`) is owner-only and never in a public response. |
| Delete a listing for good | Its owner (session) or admin. Irreversible: removes the row and its photos from disk. **Conversations and visits are KEPT** — each side owns its own history, so the landlord leaves the thread (it drops out of their inbox, read-only for the tenant) rather than erasing what the tenant wrote. Refused while a payment for it is pending. Payments, reports and the audit entry are kept. |
| View own library incl. taken-down homes | That owner |
| Read/write a chat thread | The thread's tenant, or the listing owner |
| Owner reply | Only into an existing tenant thread |
| Request a visit | Any signed-in user except the owner |
| See visits on a listing | Owner: all; tenant: own; signed out: none |
| Confirm/decline a visit | The side that did not propose the current time |
| Cancel / reschedule a visit | Either side of that visit |
| Block a conversation | Either participant; only the blocker unblocks |
| Report a conversation | Its participants |
| Report a listing | Any signed-in user except its owner |
| Read any conversation, review reports | Admin (moderation) |
| Mark activation transfer sent | The session account itself |
| Set / remove own profile photo | The session account itself (any role, activated or not) |
| Submit a payment reference | Landlord (activation: own account; advertising: own active listing) |
| Confirm / reject a payment | Admin only; a payment can be confirmed once |
| Full accounts list, activation, advertising, partners, revenue, settings | Admin (middleware gate) |
| Trigger the scheduled job (`/api/cron`) | Anyone holding `CRON_SECRET`. Compared in constant time; **fail closed** — with no secret set the endpoint answers 503 rather than running. Rate-limited per IP. It is reachable through the tunnel, so the secret is the only thing in front of it; keep it out of the repo like `ADMIN_PASSWORD`. |
| Per-account engagement figures (last seen, logins, average session, visits) | Admin only. Merged into the admin-gated `GET /api/accounts` list, never into `pub()`, so they cannot reach a public profile or `/api/accounts/me`. Tested. |
| Public profile lookup | Anyone — username, name, role only |

## Chat privacy

A thread is `(listing_id, tenant)`. Migration `chat-per-tenant-threads`
split the old one-per-listing threads:
- each tenant message goes to its author
- each owner reply goes to the tenant who wrote last before it
- messages from signed-out writers go to an owner-only legacy thread (`tenant = ''`)

Read and hidden markers moved with their threads.

## Abuse limits (in-memory, per container)

| Route | Limit |
|-------|-------|
| Sign-in | 10 / 15 min per username, 100 / 15 min per IP |
| Signup | 40 / hour per IP |
| Password reset | 5 / hour per username, 20 / hour per IP |
| Upload | 60 / hour per account |
| Profile photo | 10 / hour per account |
| Listing view count | 120 / hour per IP (volume ceiling), then 1 per viewer per 30 min |
| Scheduled job (`/api/cron`) | 60 / hour per IP |
| Chat send | 30 / min per account |

The client IP comes from `cf-connecting-ip` (Cloudflare Tunnel). Per-IP
limits are generous on purpose: Haitian mobile carriers put many
subscribers behind one shared (CGNAT) address, so the per-username
limits are what actually stop password guessing.

## Uploads

- Allowed: activated landlords only for listing media (`/api/upload`).
  Profile photos (`/api/accounts/avatar`) are open to any signed-in
  account — tenants have a profile too, and are never "activated" — but
  are images only, 8 MB, 10 changes an hour. The stored value is always a
  path this server wrote, never a URL from the client, so a profile photo
  cannot point at a third-party tracker. Both doors share the format and
  magic-byte checks in `lib/upload-file.js`: one copy, because two copies
  drift and the stale one becomes the hole.
- Formats: jpg, jpeg, png, webp, gif, avif, mp4, mov, webm. These are
  exactly the formats `/uploads/[file]` serves, so SVG/HTML can never be
  stored and served.
- Size limits: 10 MB images, 100 MB videos.
- Content check: the first bytes must match the extension (JPEG, PNG,
  GIF, WebP, AVIF, MP4/MOV, WebM). An HTML file renamed to `.jpg` is
  refused.

## Output encoding

React escapes by default. The one raw-HTML sink, Leaflet popups in
`components/ListingMap.jsx`, escapes every listing value.

## Known open items

- A nonce-based Content-Security-Policy.
- `npm audit` hasn't been run (the registry timed out). Run it in CI or
  by hand.
- Rate limits live in one process. Move them to Postgres or Redis if the
  app ever runs as more than one container.
- SMS/WhatsApp self-serve recovery codes, once a sending channel exists.
- `login_events` records a behavioural history (when each account signs
  in, how long it stays). It is append-only, admin-only, and never
  consulted for authorization — a failure to write one can never lock
  anybody out. It is still personal data: if a retention policy is ever
  adopted, this table needs a cutoff, because nothing prunes it today.
- Listing view counts come from a browser-supplied visitor id, so a
  determined person could inflate the count on their own listing. It is a
  vanity metric nobody is billed on, and a per-IP ceiling caps the volume;
  do not reuse this counter for anything that charges money.

## Audit trail

`audit_log` records:
- admin logins and failed logins (with IP)
- account activation, deactivation and partner creation
- reset codes issued (never the code itself)
- payment confirmations and rejections, and payment-number changes
- listing verification, advertising and takedown/restore
- report resolutions
- **every time the admin reads a private conversation**
- listing deletion, with what it removed (messages, visits, files)
- sold / leased tags, with the deletion deadline they set

Entries are also written as JSON log lines.

## Container

The app runs as the unprivileged `node` user. The entrypoint only uses
root to hand the uploads folder to `node`.

## Reporting

Report vulnerabilities privately to the maintainer (Spencer). Do not
open public issues for security problems.
