# Kay Ayiti — mobile apps (Android + iOS)

One codebase, two native apps. Both shells load the live site
(https://kayayiti.app) in remote-URL mode — the same pattern as the
Farelune app. There is no bundled web build: shipping a site update
updates both apps automatically. Only native-shell changes (icon, splash,
permissions, plugins) need a store update.

## What was scaffolded

- `capacitor.config.ts` — appId `com.kayayiti.app`, appName `Kay Ayiti`,
  `server.url` https://kayayiti.app, splash screen (1500 ms, `#bae6fd`
  background).
- `android/` — full Android Studio project (Gradle, JDK 17).
- `ios/` — full Xcode project (workspace + App target).
- Icons + splash screens generated from `resources/icon.png` (1600×1600)
  with `@capacitor/assets` (icon and splash backgrounds `#bae6fd`).
  To regenerate after changing the icon: `npx @capacitor/assets generate`.
- `.github/workflows/build-mobile.yml` — CI builds (see below).
- `ios/App/ExportOptions.plist` — App Store export options template.
  **Replace `YOUR_TEAM_ID` with the real Apple Developer Team ID before
  the first signed iOS build.**

Note: the first `@capacitor/assets` run failed with an npm EPERM error
because `~/.npm` contains root-owned files. It succeeded after pointing
npm at a fresh cache dir (`NPM_CONFIG_CACHE=/tmp/npm-cache-fresh`).
If asset generation fails for you the same way, use that env var.
`resources/icon.png` is the single source of truth for the icon.

## Build locally

```sh
npm install
npx cap sync            # re-sync the native shells after config changes
npx cap open android    # Android Studio
npx cap open ios        # Xcode (macOS only)
```

Android release from Android Studio: Build → Generate Signed App Bundle /
APK (needs a keystore — create one once and keep it safe; losing it
means you can never update the app under the same listing).

## Android release path (Google Play)

1. CI (`.github/workflows/build-mobile.yml`, `android` job) builds the
   release AAB and APK on every push to `main` touching the mobile files
   and uploads both as artifacts. Download the AAB from the workflow run.
2. Open a Google Play developer account: **$25 one-time fee**.
3. In Play Console, create the app, upload the AAB, complete the store
   listing (title, description, screenshots, category), and submit.
4. The AAB — not the APK — is what Play wants for new apps.

## iOS release path (App Store)

1. Enroll in the Apple Developer Program: **$99/year**.
2. In Xcode or developer.apple.com, create an App ID for
   `com.kayayiti.app` plus a distribution certificate and an App Store
   provisioning profile.
3. Add three repository secrets (Settings → Secrets → Actions):
   `APPLE_CERTIFICATE_P12` (base64 .p12), `APPLE_CERTIFICATE_PASSWORD`,
   `APPLE_PROVISIONING_PROFILE` (base64 .mobileprovision).
4. Replace `YOUR_TEAM_ID` in `ios/App/ExportOptions.plist` with the real
   Team ID, and make sure the provisioning profile name in that file
   matches the profile you created.
5. CI (`.github/workflows/build-mobile.yml`, `ios` job) then builds the
   signed IPA and uploads it as an artifact.
6. Upload the IPA to App Store Connect (Transporter app or Xcode) and
   submit from there.

**If the three Apple secrets are absent, the iOS CI job prints these
setup steps and succeeds anyway — missing secrets never fail CI.**
That is deliberate: the Android job still runs and the workflow stays
green while the Apple account is being set up.

## Store listings

Both stores require a privacy policy URL. The app will have one at
`/[locale]/privacy` (per-language, e.g. https://kayayiti.app/ht/privacy).
Point the Play and App Store listings at that URL once the page ships.

## Service worker & offline (Phase 14a + 14b)

`public/sw.js` is the service worker registered by
`components/ServiceWorkerRegister.jsx` (rendered once in `app/layout.js`).
It works in both native shells — Android WebView and iOS WKWebView run
service workers for an https remote URL, which is exactly our setup.

**14a (shell):** precaches a self-contained offline page
(`public/offline.html`) and the logo, and serves that page when a **fresh
navigation** (cold open, refresh, address bar) can't reach the network —
no more dead white screen on a dropped signal.

**14b (caching what costs data):** runtime caches so repeat visits transfer
almost nothing and already-seen pages open with no signal. Each strategy is
picked so a stale copy can't mislead:
- `/_next/static/*` — **cache-first** (filenames are build-hashed, so a
  cached copy is identical forever).
- `/uploads/...?w=` — **cache-first, capped at ~60**. Only the resized photo
  thumbnails cards/galleries use; full-size originals, videos and voice
  notes are left to the network so the cache can't balloon.
- `GET /api/listings` with no query — **stale-while-revalidate** (the public
  feed shows instantly and refreshes behind it). The owner/admin/viewer
  variants carry a query string and are never cached, so no signed-in data
  is stored.
- navigations — **network-first** (always fresh online; offline, the last
  good copy of that page, else the offline page). Pages that can carry
  signed-in content (`/account`, `/admin*`, `/library`, `/chats`,
  `/payments`, `/visits`, auth) are never stored.

The web manifest (`public/manifest.webmanifest`) is complete enough to
install as a standalone app (`start_url` `/ht`, `display` standalone,
`theme_color`/`background_color` `#bae6fd` to match the native splash).

**Testing the caching (manual — the node test harness can't drive a service
worker):** in Chrome DevTools → Application → Service Workers, load the site,
then tick **Offline** and reload — a previously-viewed page and its photos
should still render. In the Network tab, a second visit should show
`_next/static` and `?w=` photos served "(ServiceWorker)". Lighthouse's PWA
audit should pass. Repeat inside the Android/iOS shells with airplane mode.

**Updating the worker:** bump `VERSION` in `public/sw.js`. Every old cache is
deleted on activate. `/sw.js` is served `no-cache` (a rule in
`next.config.js`), so a new worker is noticed on the next visit; the page
then shows a small "Mete ajou" prompt rather than reloading under the user.

**Edge caching note:** in production kayayiti.app sits behind Cloudflare,
which caches `.js` by extension and rewrites `/sw.js` to `cache-control:
max-age=14400` — overriding our origin `no-cache`. Two things keep the
worker always updatable anyway: we register with `updateViaCache: 'none'`
(the browser fetches `/sw.js` from the network on every update check), and
Cloudflare's edge revalidates against origin (`cf-cache-status:
REVALIDATED`). For belt-and-suspenders, add a Cloudflare **Cache Rule** —
`URI Path equals /sw.js` → *Bypass cache* (or set Browser Cache TTL to
"Respect Existing Headers") — so the browser gets our `no-cache` verbatim.

**Kill switch (if a worker ever misbehaves):** replace the body of
`public/sw.js` with the two lines below and redeploy. Every client unregisters
itself and clears the caches on its next visit, returning to plain network
fetching. Because `/sw.js` is uncached, this propagates on the next load.

```js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', async () => {
  await self.registration.unregister();
  for (const k of await caches.keys()) await caches.delete(k);
  for (const c of await self.clients.matchAll()) c.navigate(c.url);
});
```

## Offline send queue (Phase 14c-2)

A chat message typed with no signal is queued, not lost. `lib/outbox.js` is
a durable (localStorage) queue; `components/OutboxFlusher.jsx` (in the root
layout) drains it on load, on `online`, and on tab refocus, and `ChatBox`'s
5s poll also flushes. A queued message shows as a faded "sending" bubble and
goes out on reconnect; a `clientId` (migration 0025) makes the replay
idempotent, so it can never post twice. Server rejections (blocked,
suspended) are not queued — they can't succeed on retry.

Both outbound actions a visitor can take with no signal queue this way: a
**chat message** (14c-2) and a **visit request** (14c-3, via
`VisitScheduler`, which shows a "waiting for connection" note). Offline voice
notes stay out of scope — the audio upload itself can't happen offline.

**Testing (manual — needs a browser):** open a chat, DevTools → Offline (or
airplane mode in the shell), send a message → it appears "sending"; go back
online → within ~5s it sends and the clock turns into a tick. Same for a
visit request: propose one offline → "waiting for connection" note → it
sends on reconnect.

## What is NOT done yet

- No keystore exists yet for local signed Android builds (CI builds
  unsigned release artifacts; sign the AAB in Play Console's flow or add
  signing config to `android/app/build.gradle`).
- No Apple account, certificate, provisioning profile, or Team ID yet —
  the iOS job will print setup steps until those exist.
- No store listings, screenshots, or descriptions have been written.
- Privacy policy page (`/[locale]/privacy`) EXISTS, linked from the
  landing footer — use https://kayayiti.app/ht/privacy (or /fr, /en) in
  both store listings.
