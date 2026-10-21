import Link from 'next/link';
import { getDict } from '@/lib/dictionaries';
import { LISTINGS } from '@/lib/listings';
import { DEPARTMENTS } from '@/lib/departments';
import Header from '@/components/Header';
import ListingCard from '@/components/ListingCard';

export default function LocaleHome({ params }) {
  const t = getDict(params.locale);
  return (
    <>
      <Header locale={params.locale} browse={t.browse} listHome={t.listHome} favorites={t.favorites} savedSearches={t.savedSearches} />
      <main className="container">
        <section className="hero">
          <h1>{t.tagline}</h1>
          <p>{t.browse} — Port-au-Prince, Okap, Jakmèl, ak tout Ayiti.</p>
          <form method="get" action={`/${params.locale}/listings`} style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <input className="input" name="q" placeholder={t.searchPlaceholder} style={{ flex: 1 }} />
            <button className="btn" type="submit">{t.browse}</button>
          </form>
        </section>
        <h2>{t.department}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DEPARTMENTS.map((d) => (
            <Link key={d.id} className="chip" href={`/${params.locale}/listings?department=${d.id}`}>{d.communes[0]}</Link>
          ))}
        </div>
        <h2 style={{ marginTop: 36 }}>{t.browse}</h2>
        <div className="grid grid-2">
          {LISTINGS.slice(0, 4).map((l) => (
            <ListingCard key={l.id} listing={l} locale={params.locale} t={t} />
          ))}
        </div>
        <p className="muted" style={{ marginTop: 32 }}>{t.demoNote}</p>
      </main>
    </>
  );
}
