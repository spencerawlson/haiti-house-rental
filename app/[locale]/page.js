import Link from 'next/link';
import { getDict } from '@/lib/dictionaries';
import { getListings } from '@/lib/listings-server';
import { DEPARTMENTS, departmentName } from '@/lib/departments';
import TabBar from '@/components/TabBar';
import ListingCard from '@/components/ListingCard';
import AdvertisedCarousel from '@/components/AdvertisedCarousel';

export const dynamic = 'force-dynamic';

// In-app home (design: docs/design/app-showcase.png, screen 4): logo +
// messages bell, search pill, quick chips, departments as photo circles,
// then the advertised carousel (paid visibility, honestly labeled) and
// the newest homes. Department circles use the four Haiti illustrations
// in turn — illustrative, not photos of that department.
const DEPT_ART = ['landing-house', 'landing-mountain', 'landing-beach', 'landing-palms'];

export default async function LocaleHome({ params }) {
  const t = getDict(params.locale);
  const base = `/${params.locale}`;
  const LISTINGS = await getListings();
  const advertised = LISTINGS.filter((l) => l.advertised);
  const chips = [
    { href: `${base}/listings?purpose=rent`, label: t.forRent },
    { href: `${base}/listings?purpose=sale`, label: t.forSale },
    { href: `${base}/listings?type=apartment`, label: t.apartment },
    { href: `${base}/listings?type=house`, label: t.house },
    { href: `${base}/listings?type=land`, label: t.land },
    { href: `${base}/near-me`, label: `📍 ${t.nearMe}` },
  ];
  return (
    <>
      <main className="container">
        <header className="topbar">
          <Link href={base} className="logo">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></svg>
            Kay Ayiti
          </Link>
          <Link href={`${base}/chats`} className="icon-btn" aria-label={t.tabMessages}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 21h4" /></svg>
          </Link>
        </header>
        <form method="get" action={`${base}/listings`} className="search-pill" role="search">
          <span aria-hidden="true">🔍</span>
          <input name="q" placeholder={t.searchPlaceholder} aria-label={t.searchPlaceholder} />
          <button type="submit">{t.tabSearch}</button>
        </form>
        <nav className="chip-row" aria-label={t.filters}>
          {chips.map((c) => <Link key={c.href} className="chip" href={c.href}>{c.label}</Link>)}
        </nav>

        <div className="section-head"><h2>{t.department}</h2></div>
        <nav className="dept-row" aria-label={t.department}>
          {DEPARTMENTS.map((d, i) => (
            <Link key={d.id} className="dept" href={`${base}/listings?department=${d.id}`}>
              <span className="dept-photo" style={{ backgroundImage: `url(/images/${DEPT_ART[i % DEPT_ART.length]}.jpg)` }} />
              {departmentName(d.id, params.locale)}
            </Link>
          ))}
        </nav>

        {advertised.length > 0 && (
          <>
            <div className="section-head"><h2>📣 {t.advertisedSection}</h2></div>
            <AdvertisedCarousel>
              {advertised.map((l) => (
                <ListingCard key={l.id} listing={l} locale={params.locale} t={t} />
              ))}
            </AdvertisedCarousel>
          </>
        )}

        <div className="section-head">
          <h2>{t.newestHomes}</h2>
          <Link href={`${base}/listings`}>{t.seeAll}</Link>
        </div>
        <div className="listing-grid">
          {LISTINGS.slice(0, 6).map((l) => (
            <ListingCard key={l.id} listing={l} locale={params.locale} t={t} />
          ))}
        </div>
        <p style={{ marginTop: 24 }}>
          <Link className="btn btn-secondary" href={`${base}/list`} style={{ width: '100%' }}>＋ {t.postHome}</Link>
        </p>
      </main>
      <TabBar locale={params.locale} />
    </>
  );
}
