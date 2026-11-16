'use client';

import { useEffect, useState } from 'react';

// Cookie consent banner (R-04). Kay Ayiti loads no non-essential
// cookie or tracker today — analytics is Ventoryn, first-party and
// cookieless, and the only cookies are the essential session and
// language ones — but the banner still matters the moment any optional
// tracker loads: the choice is recorded here first, and any future
// non-essential script must read it (localStorage key below) before
// loading. Nothing optional loads before the visitor chooses.
//
// The banner renders on the server (visible by default) so it is in
// the HTML a crawler sees; after hydration it hides itself when a
// choice is already stored.
const STORE_KEY = 'kay_cookie_consent';

const STRINGS = {
  ht: {
    text: 'Nou itilize cookie esansyèl yo sèlman (sesyon, lang). Pa gen okenn tracker piblisite pou kounye a — chwa ou anrejistre pou lè nou ta ajoute yon zouti opsyonèl.',
    accept: 'Aksepte tout',
    decline: 'Refize',
    prefs: 'Preferans',
    save: 'Sere preferans',
    essential: 'Esansyèl (toujou aktive)',
    analytics: 'Analitik',
    marketing: 'Maketing',
    privacy: 'Règ sou vi prive',
  },
  fr: {
    text: 'Nous utilisons uniquement des cookies essentiels (session, langue). Aucun traqueur publicitaire pour le moment — votre choix est enregistré pour le jour où nous ajouterions un outil facultatif.',
    accept: 'Tout accepter',
    decline: 'Refuser',
    prefs: 'Préférences',
    save: 'Enregistrer mes préférences',
    essential: 'Essentiels (toujours actifs)',
    analytics: 'Analytique',
    marketing: 'Marketing',
    privacy: 'Politique de confidentialité',
  },
  en: {
    text: 'We use essential cookies only (session, language). No advertising trackers right now — your choice is saved for if we ever add an optional tool.',
    accept: 'Accept all',
    decline: 'Decline',
    prefs: 'Preferences',
    save: 'Save preferences',
    essential: 'Essential (always on)',
    analytics: 'Analytics',
    marketing: 'Marketing',
    privacy: 'Privacy policy',
  },
};

export default function CookieConsent() {
  const [visible, setVisible] = useState(true);
  const [showPrefs, setShowPrefs] = useState(false);
  const [locale, setLocale] = useState('ht');
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORE_KEY)) {
        setVisible(false);
        return;
      }
    } catch {}
    const m = document.cookie.match(/(?:^|; )kay_locale=(ht|fr|en)/);
    if (m) setLocale(m[1]);
  }, []);

  function save(choice) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ necessary: true, analytics: choice.analytics, marketing: choice.marketing, ts: Date.now() }));
    } catch {}
    setVisible(false);
  }

  if (!visible) return null;
  const t = STRINGS[locale] || STRINGS.ht;
  return (
    <section id="cookie-consent" data-testid="cookie-consent" className="cookie-banner" role="region" aria-label="Cookie consent">
      <p style={{ margin: 0 }}>{t.text} <a href={`/${locale}/privacy`}>{t.privacy}</a></p>
      {showPrefs && (
        <div className="cookie-prefs">
          <label><input type="checkbox" checked disabled /> {t.essential}</label>
          <label><input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} /> {t.analytics}</label>
          <label><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} /> {t.marketing}</label>
        </div>
      )}
      <div className="cookie-actions">
        {showPrefs ? (
          <button type="button" className="btn" onClick={() => save({ analytics, marketing })}>{t.save}</button>
        ) : (
          <>
            <button type="button" className="btn" onClick={() => save({ analytics: true, marketing: true })}>{t.accept}</button>
            <button type="button" className="btn btn-secondary" onClick={() => save({ analytics: false, marketing: false })}>{t.decline}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowPrefs(true)}>{t.prefs}</button>
          </>
        )}
      </div>
    </section>
  );
}
