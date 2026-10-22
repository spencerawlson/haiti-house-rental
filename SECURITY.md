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
| Confirm/decline a visit | Listing owner |
| Mark activation transfer sent | The session account itself |
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
| Sign-in | 10 / 15 min per username, 30 / 15 min per IP |
| Signup | 10 / hour per IP |
| Password reset | 5 / hour per username, 20 / hour per IP |
| Upload | 60 / hour per account |
| Chat send | 30 / min per account |

The client IP comes from `cf-connecting-ip` (Cloudflare Tunnel).

## Uploads

- Allowed: activated landlords only.
- Formats: jpg, jpeg, png, webp, gif, avif, mp4, mov, webm. These are
  exactly the formats `/uploads/[file]` serves, so SVG/HTML can never be
  stored and served.
- Size limits: 10 MB images, 100 MB videos.

## Output encoding

React escapes by default. The one raw-HTML sink, Leaflet popups in
`components/ListingMap.jsx`, escapes every listing value.

## Known open items

See `AUDIT.md` #10–13 and #15:
- admin session rotation and expiry
- a stronger password-recovery channel
- an Origin/CSRF check
- the Next.js upgrade
- magic-byte checks on uploads

## Reporting

Report vulnerabilities privately to the maintainer (Spencer). Do not
open public issues for security problems.
