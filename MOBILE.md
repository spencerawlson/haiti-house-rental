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

## Service worker & offline (Phase 14a)

`public/sw.js` is a small service worker registered by
`components/ServiceWorkerRegister.jsx` (rendered once in `app/layout.js`).
It works in both native shells — Android WebView and iOS WKWebView run
service workers for an https remote URL, which is exactly our setup.

What it does today (14a): precaches a self-contained offline page
(`public/offline.html`) and the logo, and serves that page when a **fresh
navigation** (cold open, refresh, address bar) can't reach the network —
no more dead white screen on a dropped signal. It does **not** cache
listings, photos, API data or `_next` assets yet; those go straight to the
network as before. Caching real content is Phase 14b.

The web manifest (`public/manifest.webmanifest`) is now complete enough to
install as a standalone app (`start_url` `/ht`, `display` standalone,
`theme_color`/`background_color` `#bae6fd` to match the native splash).

**Updating the worker:** bump `CACHE_VERSION` in `public/sw.js`. Old caches
are deleted on activate. `/sw.js` is served `no-cache` (a rule in
`next.config.js`), so a new worker is noticed on the next visit; the page
then shows a small "Mete ajou" prompt rather than reloading under the user.

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
