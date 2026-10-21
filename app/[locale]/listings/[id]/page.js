import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDict } from '@/lib/dictionaries';
import { getListing } from '@/lib/listings';

export default function ListingDetail({ params }) {
  const t = getDict(params.locale);
  const l = getListing(params.id);
  if (!l) notFound();
  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: 24 }}>
      <Link href={`/${params.locale}/listings`}>{t.back}</Link>
      <h1>{l.title}</h1>
      <p>{l.commune} — {l.type}</p>
      <p>{l.bedrooms} {t.bedrooms} · {l.bathrooms} {t.bathrooms}</p>
      <p><strong>{l.priceHTG.toLocaleString()} HTG {t.perMonth}</strong></p>
      <button type="button">{t.contact}</button>
      <p style={{ marginTop: 40, color: '#666' }}>{t.demoNote}</p>
    </main>
  );
}
