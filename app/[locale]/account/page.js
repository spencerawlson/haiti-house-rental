import Link from 'next/link';
import { getDict } from '@/lib/dictionaries';
import { LOCALES } from '@/lib/config';
import TabBar from '@/components/TabBar';

// Centris-style Account screen: only what exists today. Personal info and
// sign-in arrive with accounts; no payment calculator — Haiti is a
// no-mortgage market.
export default function Account({ params }) {
  const t = getDict(params.locale);
  return (
    <>
      <main className="container">
        <h1>{t.account}</h1>
        <h2>{t.myActivity}</h2>
        <div className="grid">
          <Link href={`/${params.locale}/saved-searches`} className="card" style={{ color: 'inherit' }}>
            <div className="card-body">🔔 {t.savedSearches} <span style={{ float: 'right' }}>›</span></div>
          </Link>
          <Link href={`/${params.locale}/favorites`} className="card" style={{ color: 'inherit' }}>
            <div className="card-body">♥ {t.favorites} <span style={{ float: 'right' }}>›</span></div>
          </Link>
          <Link href={`/${params.locale}/near-me`} className="card" style={{ color: 'inherit' }}>
            <div className="card-body">📍 {t.nearMe} <span style={{ float: 'right' }}>›</span></div>
          </Link>
          <Link href={`/${params.locale}/list`} className="card" style={{ color: 'inherit' }}>
            <div className="card-body">＋ {t.postHome} <span style={{ float: 'right' }}>›</span></div>
          </Link>
        </div>
        <h2 style={{ marginTop: 32 }}>{t.settings}</h2>
        <div className="card">
          <div className="card-body">
            <p style={{ margin: '0 0 8px' }}>{t.language}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {LOCALES.map((l) => (
                <Link key={l} className={l === params.locale ? 'btn' : 'btn btn-secondary'} href={`/${l}/account`} style={{ minHeight: 40, padding: '8px 16px' }}>
                  {l === 'ht' ? 'Kreyòl' : l === 'fr' ? 'Français' : 'English'}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 24 }}>{t.accountNote}</p>
      </main>
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
