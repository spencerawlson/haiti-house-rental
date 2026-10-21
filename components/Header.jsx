import Link from 'next/link';
import { LOCALES } from '@/lib/config';

export default function Header({ locale, browse, listHome, favorites, savedSearches, nearMe }) {
  return (
    <header className="header">
      <Link href={`/${locale}`} className="brand">Kay <span>Ayiti</span></Link>
      <nav className="nav">
        <Link href={`/${locale}/listings`}>{browse}</Link>
        {nearMe && <Link href={`/${locale}/near-me`}>📍 {nearMe}</Link>}
        {favorites && <Link href={`/${locale}/favorites`}>♥ {favorites}</Link>}
        {savedSearches && <Link href={`/${locale}/saved-searches`}>🔔 {savedSearches}</Link>}
        <Link href={`/${locale}/list`}>{listHome}</Link>
        {LOCALES.filter((l) => l !== locale).map((l) => (
          <Link key={l} href={`/${l}`}>{l.toUpperCase()}</Link>
        ))}
      </nav>
    </header>
  );
}
