'use client';

import { useRouter } from 'next/navigation';

// Desktop-only language switcher for the landing top right. Mobile shows
// nothing on top (language lives in Account → Settings). Only the two
// languages NOT currently selected appear, as short codes with a space
// between them: KR picked → FR EN, FR picked → KR EN, EN picked → KR FR.
const CODES = { ht: 'KR', fr: 'FR', en: 'EN' };

export default function LandingLangSwitch({ current }) {
  const router = useRouter();
  const others = ['ht', 'fr', 'en'].filter((l) => l !== current);
  function pick(l) {
    document.cookie = `kay_locale=${l}; path=/; max-age=31536000`;
    try { localStorage.setItem('kay_locale', l); } catch {}
    router.refresh();
  }
  return (
    <div className="lang-switch-desktop">
      {others.map((l) => (
        <button key={l} type="button" className="lang-code" onClick={() => pick(l)}>
          {CODES[l]}
        </button>
      ))}
    </div>
  );
}
