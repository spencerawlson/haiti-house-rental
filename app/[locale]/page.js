import Link from 'next/link';
import { getDict } from '@/lib/dictionaries';
import { getListings } from '@/lib/listings-server';
import { DEPARTMENTS, departmentName } from '@/lib/departments';
import TabBar from '@/components/TabBar';
import ListingCard from '@/components/ListingCard';
import AdvertisedCarousel from '@/components/AdvertisedCarousel';

export const dynamic = 'force-dynamic';

export default async function LocaleHome({ params }) {
  const t = getDict(params.locale);
  const LISTINGS = await getListings();
  return (
    <>
      <main className="container">
        <section className="hero">
          <h1>{t.tagline}</h1>
          <p>{t.browse} — Port-au-Prince, Okap, Jakmèl, ak tout Ayiti.</p>
          <form method="get" action={`/${params.locale}/listings`} style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <input className="input" name="q" placeholder={t.searchPlaceholder} style={{ flex: 1 }} />
            <button className="btn" type="submit">{t.browse}</button>
          </form>
          <p style={{ marginTop: 16 }}>
            <Link className="btn btn-secondary" href={`/${params.locale}/near-me`}>📍 {t.nearMe}</Link>{' '}
            <Link className="btn btn-secondary" href={`/${params.locale}/list`}>＋ {t.postHome}</Link>
          </p>
        </section>
        {LISTINGS.some((l) => l.advertised) && (
          <>
            <h2 style={{ marginTop: 36 }}>{t.advertisedSection}</h2>
            <AdvertisedCarousel>
              {LISTINGS.filter((l) => l.advertised).map((l) => (
                <ListingCard key={l.id} listing={l} locale={params.locale} t={t} />
              ))}
            </AdvertisedCarousel>
          </>
        )}
        <h2>{t.department}</h2>        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DEPARTMENTS.map((d) => (
            <Link key={d.id} className="chip" href={`/${params.locale}/listings?department=${d.id}`}>{departmentName(d.id, params.locale)}</Link>
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
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
