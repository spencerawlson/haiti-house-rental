import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDict } from '@/lib/dictionaries';
import { getListing } from '@/lib/listings-server';
import { rentPeriodLabel } from '@/lib/listings';
import { communeName, departmentName } from '@/lib/departments';
import TabBar from '@/components/TabBar';
import TakeDownButton from '@/components/TakeDownButton';
import ListingPhotos from '@/components/ListingPhotos';
import EditListingButton from '@/components/EditListingButton';
import VisitScheduler from '@/components/VisitScheduler';
import ReportListingButton from '@/components/ReportListingButton';
import ListingFacts from '@/components/ListingFacts';
import FavoriteButton from '@/components/FavoriteButton';
import ViewPing from '@/components/ViewPing';

export const dynamic = 'force-dynamic';

// Listing detail (design: docs/design/app-showcase.png, screen 7): hero
// photo with back + favorite, a sheet with title, place, blue price, the
// rooms row, fact tiles, description, then visits — and a sticky
// "Contact the owner" button.
export default async function ListingDetail({ params }) {
  const t = getDict(params.locale);
  const base = `/${params.locale}`;
  const l = await getListing(params.id);
  if (!l || l.status !== 'active') notFound();
  const d = l.details || {};
  return (
    <>
      <main className="container">
        <ViewPing listingId={l.id} />
        <div className="detail-hero">
          <Link href={`${base}/listings`} className="hero-btn" style={{ left: 14 }} aria-label={t.back}>←</Link>
          <FavoriteButton listingId={l.id} />
          <ListingPhotos photos={l.photos || []} placeholder={communeName(l.commune, params.locale)} hero />
        </div>
        <section className="detail-sheet">
          <p style={{ display: 'flex', gap: 8, margin: '0 0 8px', flexWrap: 'wrap' }}>
            <EditListingButton listingId={l.id} owner={l.owner} locale={params.locale} label={t.editListing} />
            <TakeDownButton listingId={l.id} owner={l.owner} locale={params.locale} confirmText={t.takeDownConfirm} label={t.takeDown} />
          </p>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem' }}>{l.title}</h1>
          <p style={{ margin: 0, color: 'var(--primary)', fontWeight: 700 }}>
            📍 {communeName(l.commune, params.locale)}, {departmentName(l.department, params.locale)}
          </p>
          {(l.advertised || l.verified) && (
            <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 0' }}>
              {l.verified && <span className="badge-verified">✓ {t.verifiedListing}</span>}
              {l.advertised && <span className="badge">📣 {t.advertised}</span>}
            </p>
          )}
          <p style={{ margin: '12px 0 0', fontSize: '1.6rem', fontWeight: 900, color: 'var(--primary)' }}>
            {l.priceHTG.toLocaleString()} HTG
            {l.purpose === 'rent' && <span style={{ fontSize: '1rem', fontWeight: 600 }}> {rentPeriodLabel(l.rentPeriod, t)}</span>}
          </p>
          <div className="icon-row" style={{ fontSize: '0.95rem', gap: 18, margin: '10px 0 0', color: 'var(--ink)' }}>
            {l.type === 'land' ? (
              <span>📐 {l.areaM2 ? `${l.areaM2.toLocaleString()} m²` : t.land}</span>
            ) : (
              <>
                <span>🛏 {l.bedrooms} {t.bedrooms}</span>
                <span>🛁 {l.bathrooms} {t.bathrooms}</span>
              </>
            )}
            <span>🏠 {l.type === 'house' ? t.house : l.type === 'land' ? t.land : t.apartment}</span>
            {(d.internet === 'included' || d.internet === 'available') && <span>📶 WiFi</span>}
          </div>
          <ListingFacts details={l.details} t={t} locale={params.locale} />
          {l.description && (
            <>
              <h2 style={{ fontSize: '1.1rem', margin: '22px 0 6px' }}>{t.description}</h2>
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{l.description}</p>
            </>
          )}
          {l.videos?.length > 0 && (
            <>
              <h2 style={{ fontSize: '1.1rem', margin: '22px 0 6px' }}>{t.videosLabel}</h2>
              <div style={{ display: 'grid', gap: 12 }}>
                {l.videos.map((src) => (
                  <video key={src} src={src} controls preload="metadata" style={{ width: '100%', borderRadius: 12 }} />
                ))}
              </div>
            </>
          )}
          <VisitScheduler listingId={l.id} owner={l.owner} strings={t} locale={params.locale} />
          <ReportListingButton listingId={l.id} owner={l.owner} strings={t} />
        </section>
        <div className="sticky-cta">
          <Link className="btn" href={`${base}/chats?listingId=${l.id}`}>💬 {t.contact}</Link>
        </div>
      </main>
      <TabBar locale={params.locale} />
    </>
  );
}
