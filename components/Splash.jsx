'use client';

import { useRouter } from 'next/navigation';

// First-visit splash (design: docs/design/app-showcase.png, screen 1):
// full-screen photo, logo, tagline and the three languages. Shown only
// while no language has been saved yet (first open of the site or the
// mobile app). Picking one saves it in the kay_locale cookie — after
// that, language lives in Account → Settings as SPEC.md decides — and
// continues to the onboarding (screen 2).
const LANGS = [
  { id: 'ht', label: 'Kreyòl' },
  { id: 'fr', label: 'Français' },
  { id: 'en', label: 'English' },
];

export default function Splash() {
  const router = useRouter();
  function pick(l) {
    document.cookie = `kay_locale=${l}; path=/; max-age=31536000; samesite=lax`;
    try { localStorage.setItem('kay_locale', l); } catch {}
    router.push(`/${l}/welcome`);
  }
  return (
    <main className="splash">
      <img className="splash-bg" src="/images/landing-mountain.jpg" alt="" />
      <div className="splash-wash" />
      <div className="splash-content">
        <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" />
        </svg>
        <h1 className="splash-title">Kay Ayiti</h1>
        <p className="splash-tagline">Kay pou jodi a.<br />Yon pi bon Ayiti demen.</p>
        <div className="splash-langs">
          {LANGS.map((l, i) => (
            <button key={l.id} type="button" className={i === 0 ? 'btn' : 'btn btn-secondary'} onClick={() => pick(l.id)}>{l.label}</button>
          ))}
        </div>
        <p className="splash-foot">Lwaye • Vann • Jwenn Kay Ou</p>
      </div>
    </main>
  );
}
