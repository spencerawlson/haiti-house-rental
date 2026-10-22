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
| Submit a payment reference | Landlord (activation: own account; advertising: own active listing) |
| Confirm / reject a payment | Admin only; a payment can be confirmed once |
| Full accounts list, activation, advertising, partners, revenue, settings | Admin (middleware gate) |
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
| Chat send | 30 / min per account |

The client IP comes from `cf-connecting-ip` (Cloudflare Tunnel). Per-IP
limits are generous on purpose: Haitian mobile carriers put many
subscribers behind one shared (CGNAT) address, so the per-username
limits are what actually stop password guessing.

## Uploads

- Allowed: activated landlords only.
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

## Reporting

Report vulnerabilities privately to the maintainer (Spencer). Do not
open public issues for security problems.
