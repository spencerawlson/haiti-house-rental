import Link from 'next/link';
import { getDict } from '@/lib/dictionaries';
import { LISTINGS } from '@/lib/listings';
import { DEPARTMENTS } from '@/lib/departments';
import { LOCALES } from '@/lib/config';

export default function LocaleHome({ params }) {
  const t = getDict(params.locale);
  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: 24 }}>
      <nav style={{ display: 'flex', gap: 16, justifyContent: 'space-between' }}>
        <strong>{t.siteName}</strong>
        <span style={{ display: 'flex', gap: 12 }}>
          <Link href={`/${params.locale}/listings`}>{t.browse}</Link>
          <Link href={`/${params.locale}/list`}>{t.listHome}</Link>
          {LOCALES.filter((l) => l !== params.locale).map((l) => (
            <Link key={l} href={`/${l}`}>{l}</Link>
          ))}
        </span>
      </nav>
      <h1 style={{ marginTop: 48 }}>{t.tagline}</h1>
      <h2>{t.department}</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {DEPARTMENTS.map((d) => (
          <Link key={d.id} href={`/${params.locale}/listings?department=${d.id}`}>{d.communes[0]} ({d.id})</Link>
        ))}
      </div>
      <h2 style={{ marginTop: 40 }}>{t.browse}</h2>
      <div style={{ display: 'grid', gap: 12 }}>
        {LISTINGS.slice(0, 3).map((l) => (
          <Link key={l.id} href={`/${params.locale}/listings/${l.id}`}>
            {l.title} — {l.commune} — {l.priceHTG.toLocaleString()} HTG {t.perMonth}
          </Link>
        ))}
      </div>
      <p style={{ marginTop: 40, color: '#666' }}>{t.demoNote}</p>
    </main>
  );
}
