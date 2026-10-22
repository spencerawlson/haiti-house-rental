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
        <ListingPhotos photos={l.photos || []} placeholder={communeName(l.commune, params.locale)} />
        <h1 style={{ marginBottom: 4 }}>{l.title}</h1>
        <p className="muted" style={{ marginTop: 0 }}>{communeName(l.commune, params.locale)} · {l.type === 'house' ? t.house : l.type === 'land' ? t.land : t.apartment}</p>
        {l.description && <p style={{ whiteSpace: 'pre-wrap', marginTop: 0 }}>{l.description}</p>}
        {(l.advertised || l.verified) && (
          <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {l.verified && <span className="badge-verified">✓ {t.verifiedListing}</span>}
            {l.advertised && <span className="badge">📣 {t.advertised}</span>}
          </p>
        )}
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
            <span className="muted">{departmentName(l.department, params.locale)}</span>
          </div>
        </div>
        <ListingFacts details={l.details} t={t} locale={params.locale} />
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
          <Link className="btn" href={`/${params.locale}/chats?listingId=${l.id}`}>{t.contact}</Link>
        </div>
        <VisitScheduler listingId={l.id} owner={l.owner} strings={t} locale={params.locale} />
        <ReportListingButton listingId={l.id} owner={l.owner} strings={t} />
      </main>
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
