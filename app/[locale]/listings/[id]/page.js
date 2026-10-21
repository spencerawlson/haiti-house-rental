import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDict } from '@/lib/dictionaries';
import { getListing } from '@/lib/listings';
import Header from '@/components/Header';
import ChatBox from '@/components/ChatBox';

export default function ListingDetail({ params }) {
  const t = getDict(params.locale);
  const l = getListing(params.id);
  if (!l) notFound();
  return (
    <>
      <Header locale={params.locale} browse={t.browse} listHome={t.listHome} favorites={t.favorites} savedSearches={t.savedSearches} />
      <main className="container">
        <Link href={`/${params.locale}/listings`}>← {t.back}</Link>
        {l.photos?.length > 0 ? (
          <img src={l.photos[0]} alt="" style={{ width: '100%', height: 260, objectFit: 'cover', borderRadius: 16, marginTop: 16, display: 'block' }} />
        ) : (
          <div className="house-art" style={{ borderRadius: 16, marginTop: 16, height: 200 }}>{l.commune}</div>
        )}
        <h1 style={{ marginBottom: 4 }}>{l.title}</h1>
        <p className="muted" style={{ marginTop: 0 }}>{l.commune} · {l.type}</p>
        <p className="price">{l.priceHTG.toLocaleString()} HTG <span style={{ fontSize: '0.9rem', fontWeight: 400 }} className="muted">{t.perMonth}</span></p>
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-body" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <span><strong>{l.bedrooms}</strong> {t.bedrooms}</span>
            <span><strong>{l.bathrooms}</strong> {t.bathrooms}</span>
            <span><strong>{l.type === 'house' ? t.house : t.apartment}</strong></span>
            <span className="muted">{l.department}</span>
          </div>
        </div>
        {l.photos?.length > 1 && (
          <div className="gallery">
            {l.photos.slice(1).map((src) => (
              <img key={src} src={src} alt="" />
            ))}
          </div>
        )}
        {l.videos?.length > 0 && (
          <div>
            <h2>{t.videosLabel}</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {l.videos.map((src) => (
                <video key={src} src={src} controls style={{ width: '100%', borderRadius: 12 }} />
              ))}
            </div>
          </div>
        )}
        <div style={{ marginTop: 20 }}>
          <button className="btn" type="button">{t.contact}</button>
        </div>
        <ChatBox listingId={l.id} strings={t} />
        <p className="muted" style={{ marginTop: 32 }}>{t.demoNote}</p>
      </main>
    </>
  );
}
