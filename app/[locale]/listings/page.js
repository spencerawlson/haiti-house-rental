import Link from 'next/link';
import { getDict } from '@/lib/dictionaries';
import { LISTINGS } from '@/lib/listings';
import { DEPARTMENTS } from '@/lib/departments';

export default function Listings({ params, searchParams }) {
  const t = getDict(params.locale);
  const dep = searchParams.department || '';
  const shown = dep ? LISTINGS.filter((l) => l.department === dep) : LISTINGS;
  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: 24 }}>
      <Link href={`/${params.locale}`}>{t.back}</Link>
      <h1>{t.browse}</h1>
      <p>
        {t.department}: <Link href={`/${params.locale}/listings`}>{t.all}</Link>
        {' '}
        {DEPARTMENTS.map((d) => (
          <span key={d.id}>
            {' '}<Link href={`/${params.locale}/listings?department=${d.id}`}>{d.id}</Link>
          </span>
        ))}
      </p>
      <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
        {shown.map((l) => (
          <Link key={l.id} href={`/${params.locale}/listings/${l.id}`}>
            {l.title} — {l.commune} — {l.bedrooms} {t.bedrooms}, {l.bathrooms} {t.bathrooms} — {l.priceHTG.toLocaleString()} HTG {t.perMonth}
          </Link>
        ))}
        {shown.length === 0 && <p>{t.notFound}</p>}
      </div>
      <p style={{ marginTop: 40, color: '#666' }}>{t.demoNote}</p>
    </main>
  );
}
