import Link from 'next/link';
import { getDict } from '@/lib/dictionaries';
import { LISTINGS } from '@/lib/listings';
import { DEPARTMENTS } from '@/lib/departments';
import Header from '@/components/Header';
import ListingCard from '@/components/ListingCard';

export default function Listings({ params, searchParams }) {
  const t = getDict(params.locale);
  const dep = searchParams.department || '';
  const shown = dep ? LISTINGS.filter((l) => l.department === dep) : LISTINGS;
  return (
    <>
      <Header locale={params.locale} browse={t.browse} listHome={t.listHome} />
      <main className="container">
        <h1>{t.browse}</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          <Link className="chip" href={`/${params.locale}/listings`}>{t.all}</Link>
          {DEPARTMENTS.map((d) => (
            <Link key={d.id} className="chip" href={`/${params.locale}/listings?department=${d.id}`}>{d.communes[0]}</Link>
          ))}
        </div>
        <div className="grid grid-2">
          {shown.map((l) => (
            <ListingCard key={l.id} listing={l} locale={params.locale} t={t} />
          ))}
        </div>
        {shown.length === 0 && <p>{t.notFound}</p>}
        <p className="muted" style={{ marginTop: 32 }}>{t.demoNote}</p>
      </main>
    </>
  );
}
