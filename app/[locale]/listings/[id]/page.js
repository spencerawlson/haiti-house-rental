import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDict } from '@/lib/dictionaries';
import { getListing } from '@/lib/listings-server';
import { rentPeriodLabel } from '@/lib/listings';
import { communeName } from '@/lib/departments';
import TabBar from '@/components/TabBar';
import ChatBox from '@/components/ChatBox';
import TakeDownButton from '@/components/TakeDownButton';
import EditListingButton from '@/components/EditListingButton';
import VisitScheduler from '@/components/VisitScheduler';

export const dynamic = 'force-dynamic';

export default async function ListingDetail({ params }) {
  const t = getDict(params.locale);
  const l = await getListing(params.id);
  if (!l || l.status !== 'active') notFound();
  return (
    <>
      <main className="container">
        <Link href={`/${params.locale}/listings`}>← {t.back}</Link>
        <p style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <EditListingButton listingId={l.id} owner={l.owner} locale={params.locale} label={t.editListing} />
          <TakeDownButton listingId={l.id} owner={l.owner} locale={params.locale} confirmText={t.takeDownConfirm} label={t.takeDown} />
        </p>
        {l.photos?.length > 0 ? (
          <img src={l.photos[0]} alt="" style={{ width: '100%', height: 260, objectFit: 'cover', borderRadius: 16, marginTop: 16, display: 'block' }} />
        ) : (
          <div className="house-art" style={{ borderRadius: 16, marginTop: 16, height: 200 }}>{communeName(l.commune, params.locale)}</div>
        )}
        <h1 style={{ marginBottom: 4 }}>{l.title}</h1>
        <p className="muted" style={{ marginTop: 0 }}>{communeName(l.commune, params.locale)} · {l.type === 'house' ? t.house : l.type === 'land' ? t.land : t.apartment}</p>
        {l.description && <p style={{ whiteSpace: 'pre-wrap', marginTop: 0 }}>{l.description}</p>}
        {l.advertised && <p><span className="badge">📣 {t.advertised}</span></p>}
        <p className="price">{l.priceHTG.toLocaleString()} HTG {l.purpose === 'rent' && <span style={{ fontSize: '0.9rem', fontWeight: 400 }} className="muted">{rentPeriodLabel(l.rentPeriod, t)}</span>}</p>
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-body" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {l.type === 'land' ? (
              <span><strong>{l.areaM2 ? `${l.areaM2.toLocaleString()} m²` : t.land}</strong></span>
            ) : (
              <>
                <span><strong>{l.bedrooms}</strong> {t.bedrooms}</span>
                <span><strong>{l.bathrooms}</strong> {t.bathrooms}</span>
              </>
            )}
            <span><strong>{l.type === 'house' ? t.house : l.type === 'land' ? t.land : t.apartment}</strong></span>
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
        <ChatBox listingId={l.id} owner={l.owner} strings={t} />
        <VisitScheduler listingId={l.id} owner={l.owner} strings={t} locale={params.locale} />
        <p className="muted" style={{ marginTop: 32 }}>{t.demoNote}</p>
      </main>
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
