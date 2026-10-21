import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDict } from '@/lib/dictionaries';
import { getListing } from '@/lib/listings';
import ChatBox from '@/components/ChatBox';

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
      {l.photos?.length > 0 && (
        <div>
          <h2>{t.photosLabel}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {l.photos.map((src) => (
              <img key={src} src={src} alt="" style={{ width: 260, height: 180, objectFit: 'cover', borderRadius: 8 }} />
            ))}
          </div>
        </div>
      )}
      {l.videos?.length > 0 && (
        <div>
          <h2>{t.videosLabel}</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {l.videos.map((src) => (
              <video key={src} src={src} controls style={{ width: '100%', maxWidth: 640, borderRadius: 8 }} />
            ))}
          </div>
        </div>
      )}
      <button type="button">{t.contact}</button>
      <ChatBox listingId={l.id} strings={t} />
      <p style={{ marginTop: 40, color: '#666' }}>{t.demoNote}</p>
    </main>
  );
}
