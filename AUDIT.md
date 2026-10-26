# Kay Ayiti — Security & Quality Audit

Audit date: 2026-10-21, against `main` @ `e09b614`. Status column tracks
the fix branch `security/phase-1-sessions`.

Severity: **Critical** = any visitor can take over accounts or act as
others; **High** = private data exposed or business rules bypassed;
**Medium** = abuse/hardening; **Low** = quality.

## Security findings

| # | Severity | Finding | Where | Status |
|---|----------|---------|-------|--------|
| 1 | Critical | **No server sessions.** The browser keeps `{username}` in localStorage; APIs accept a `username`/`owner`/`tenant`/`author` from the request as identity. Anyone can edit or take down any listing, post as any activated landlord, confirm visits, mark transfers, and read inboxes. | `lib/account.js`, `app/api/listings/*`, `app/api/visits/*`, `app/api/chat/*`, `app/api/accounts/transfer` | Fixed (Phase 1) |
| 2 | Critical | **Two-request account takeover.** `GET /api/accounts?username=` returned the phone number publicly; password reset only checks username + phone. Usernames are visible on listings. | `app/api/accounts/route.js`, `app/api/password-reset/route.js` | Mitigated: phone no longer exposed, reset rate-limited, reset revokes sessions. Still phone-only — see #11 |
| 3 | High | **Public signup honored `partner: true`** → free, pre-activated landlord account, bypassing the 1000 HTG activation fee. | `app/api/accounts/route.js` → `createServerAccount(data)` | Fixed |
| 4 | High | **Stored XSS in map popups.** Listing title/commune are interpolated into Leaflet popup HTML unescaped. | `components/ListingMap.jsx:37` | Fixed |
| 5 | High | **Chats not private.** One thread per listing: every tenant sees every other tenant's messages; `GET /api/chat?listingId=` needed no sign-in; any writer could claim `sender: 'owner'`. | `lib/chat.js`, `app/api/chat/route.js` | Fixed: per-(listing, tenant) threads, session-derived roles, migration splits old threads |
| 6 | High | **Visits public.** `GET /api/visits?listingId=` listed every tenant's username, date and message to anyone; `?username=` showed anyone's visits. | `app/api/visits/route.js` | Fixed |
| 7 | High | **Password hash = password.** Unsalted client-side SHA-256 stored and compared directly; a DB leak lets anyone sign in (pass-the-hash) and the hashes crack fast. | `lib/accounts-server.js` | Fixed: salted scrypt over the client hash; boot migration wraps existing hashes (no lockout) |
| 8 | Medium | **Unauthenticated, unlimited uploads** — disk-fill. Any `image/*` (incl. SVG) accepted and stored. | `app/api/upload/route.js` | Fixed: activated landlord session, 60/h, served formats only. Content sniffing still TODO |
| 9 | Medium | **No rate limiting** on sign-in, signup, reset, chat. | all auth routes | Fixed (in-memory, single container) |
| 10 | Medium | **Admin cookie never rotates.** Cookie value = SHA-256(ADMIN_PASSWORD): fixed forever, valid until the password changes, compared non-constant-time. | `lib/admin-auth.js`, `app/api/admin/login/route.js` | Fixed (1b): signed 12h token per login, constant-time checks, admin sign-out, login rate limit |
| 11 | Medium | **Password reset is phone-only.** Anyone who knows a user's username and phone can reset. | `app/api/password-reset/route.js` | Fixed (1b): admin-assisted one-time codes (24h, single use, hashed); phone-only reset removed |
| 12 | Medium | **No CSRF defense beyond SameSite=Lax.** Lax blocks cross-site POST cookies in modern browsers, but there is no Origin check. | all POST routes | Fixed (1b): middleware refuses cross-site state-changing /api requests |
| 13 | Medium | **Next.js 14.2.5** has published security advisories (incl. middleware-bypass CVE-2025-29927, fixed in 14.2.25). The admin gate depends on middleware. | `package.json` | Fixed (1b): Next.js 14.2.35 (latest 14.2.x); `npm audit` not yet run — registry timed out |
| 14 | Low | Presence pings accepted any claimed username. | `app/api/presence/route.js` | Fixed (session-derived) |
| 15 | Low | Upload content is trusted by declared MIME + extension; no magic-byte check. | `app/api/upload/route.js` | Fixed (1b): magic-byte check per format; `nosniff` on all responses |
| 16 | High | **Payment-confirm side effects not atomic.** `reviewPayment` flipped the payment to confirmed in one UPDATE, then applied billing, revenue, and ad-budget effects as separate queries. A crash between the flip and a side effect left a CONFIRMED payment whose billing/ad effect never applied — and re-confirming was impossible because the row was no longer `pending`. | `lib/payments-server.js` `reviewPayment` | Fixed (Stage 2, A1): the flip and all side effects run in one transaction (`withTx`); a regression test proves a mid-confirm failure rolls back to pending and the payment re-confirms. Same split pattern remains in `submitPayment`, `deletePayment`, and `deleteServerAccount` (follow-up, not fixed here) |

## Product / workflow gaps

- No out-of-app notifications (SMS/WhatsApp) for messages and visits.
- ~~No listing reporting or moderation queue; no block/report in chat.~~ Done in Phase 2.
- Activation and advertising are manual with no payment reference, status history, or expiry.
- ~~Visits cannot be rescheduled or cancelled; no time-slot validation.~~ Done in Phase 2.
- Owner inbox loops one query per thread (N+1) — fine at today's size.

## Engineering gaps

- **No automated tests** before this branch. Phase 1 adds `tests/auth.test.mjs` (runs against a live throwaway instance).
- No CI for web — added in 1b (`.github/workflows/web-ci.yml`).
- Schema changes run ad hoc in `initDb()`; Phase 1 adds a `migrations` table for run-once steps, not yet reversible migration files.
- Uploaded photos stored at full size (up to 10 MB) — slow on Haitian mobile data.
- No documented database backup/restore.
- `android/gradle/wrapper/gradle-wrapper.properties` was locally bumped to Gradle 9.7.1 (outside this work) — verify against Capacitor 8 before committing.
