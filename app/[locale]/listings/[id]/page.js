import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { getDict } from '@/lib/dictionaries';
import { getSessionAccount } from '@/lib/session-server';
import { isAdminCookie } from '@/lib/admin-auth';
import { getViewerListing, getAdminListing, getPublicListing } from '@/lib/listings-server';
import ShareButtons from '@/components/ShareButtons';
import { photoSrc } from '@/lib/photo-url';
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
import Icon from '@/components/Icon';

export const dynamic = 'force-dynamic';

// Listing detail (design: docs/design/app-showcase.png, screen 7): hero
// photo with back + favorite, a sheet with title, place, blue price, the
// rooms row, fact tiles, description, then visits — and a sticky
// "Contact the owner" button.
// Link preview (Open Graph) for a shared listing: the first photo (JPEG,
// 1200 px — what WhatsApp and Facebook render reliably), the title, and
// "price · place · rooms". Built from the PUBLIC shape, so a shared link
// never reveals more than an anonymous visitor would see.
function previewText(l, t, locale) {
  const price = `${Number(l.price || 0).toLocaleString('en-US')} ${l.currency || 'HTG'}${l.purpose === 'rent' ? ` ${rentPeriodLabel(l.rentPeriod, t)}` : ''}`;
  const place = `${communeName(l.commune, locale)}, ${departmentName(l.department, locale)}`;
  const rooms = l.type === 'land' ? t.land : `${l.bedrooms} ${t.bedrooms} · ${l.bathrooms} ${t.bathrooms}`;
  return { price, place, rooms };
}

export async function generateMetadata(props) {
  const params = await props.params;
  const t = getDict(params.locale);
  const l = await getPublicListing(params.id).catch(() => null);
  if (!l || !['active', 'sold', 'leased'].includes(l.status)) return {};
  const { price, place, rooms } = previewText(l, t, params.locale);
  const title = `${l.title} · ${price}`;
  const description = [place, rooms, String(l.description || '').slice(0, 140)].filter(Boolean).join(' · ');
  const image = l.photos?.[0] ? photoSrc(l.photos[0], 1200, 'jpg') : '/images/landing-house.jpg';
  const url = `/${params.locale}/listings/${l.id}`;
  return {
    title: `${title} — Kay Ayiti`,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', siteName: 'Kay Ayiti', url, title, description, images: [{ url: image, width: 1200 }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default async function ListingDetail(props) {
  const params = await props.params;
  const t = getDict(params.locale);
  const base = `/${params.locale}`;
  // Viewer shape (Stage 2, B1): the owner and the admin see exact
  // values, a tenant the landlord replied to sees the exact address and
  // pin, everyone else the public shape. The address line below renders
  // only when the shape carries one.
  const jar = await cookies();
  const me = await getSessionAccount({ cookies: jar }).catch(() => null);
  const admin = await isAdminCookie(jar.get('kay_admin')?.value);
  const l = admin ? await getAdminListing(params.id) : await getViewerListing(params.id, me?.username || null);
  if (!l || !['active', 'sold', 'leased'].includes(l.status)) notFound();
  // A sold or leased home stays visible, tagged, and uncontactable. The
  // deletion countdown is deliberately not shown here — only its owner
  // sees that, in their library.
  const taken = l.status === 'sold' || l.status === 'leased';
  const d = l.details || {};
  return (
    <>
      <main className="container">
        <ViewPing listingId={l.id} />
        <div className="detail-hero">
          <Link href={`${base}/listings`} className="hero-btn" style={{ left: 14 }} aria-label={t.back}>←</Link>
          <FavoriteButton listingId={l.id} />
          <ListingPhotos photos={l.photos || []} placeholder={communeName(l.commune, params.locale)} hero galleryHref={`${base}/listings/${l.id}/photos`} />
        </div>
        <section className="detail-sheet">
          <p style={{ display: 'flex', gap: 8, margin: '0 0 8px', flexWrap: 'wrap' }}>
            <EditListingButton listingId={l.id} owner={l.owner} locale={params.locale} label={t.editListing} />
            <TakeDownButton listingId={l.id} owner={l.owner} locale={params.locale} confirmText={t.takeDownConfirm} label={t.takeDown} />
          </p>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem' }}>{l.title}</h1>
          <p style={{ margin: 0, color: 'var(--ink)', fontWeight: 700 }}>
            <Icon name="pin" /> {communeName(l.commune, params.locale)}, {departmentName(l.department, params.locale)}
          </p>
          {l.address ? <p style={{ margin: '4px 0 0' }}>{l.address}</p> : null}
          {(l.advertised || l.verified || taken) && (
            <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 0' }}>
              {taken && <span className="badge-taken"><Icon name="tag" /> {l.status === 'sold' ? t.statusSold : t.statusLeased}</span>}
              {l.verified && <span className="badge-verified">✓ {t.verifiedListing}</span>}
              {l.advertised && <span className="badge"><Icon name="megaphone" /> {t.advertised}</span>}
            </p>
          )}
          <p style={{ margin: '12px 0 0', fontSize: '1.6rem', fontWeight: 900, color: 'var(--ink)' }}>
            {l.price.toLocaleString()} {l.currency || 'HTG'}
            {l.purpose === 'rent' && <span style={{ fontSize: '1rem', fontWeight: 600 }}> {rentPeriodLabel(l.rentPeriod, t)}</span>}
          </p>
          <div className="icon-row" style={{ fontSize: '0.95rem', gap: 18, margin: '10px 0 0', color: 'var(--ink)' }}>
            {l.type === 'land' ? (
              <span><Icon name="area" /> {l.areaM2 ? `${l.areaM2.toLocaleString()} m²` : t.land}</span>
            ) : (
              <>
                <span><Icon name="bed" /> {l.bedrooms} {t.bedrooms}</span>
                <span><Icon name="bath" /> {l.bathrooms} {t.bathrooms}</span>
              </>
            )}
            <span><Icon name="home" /> {l.type === 'house' ? t.house : l.type === 'land' ? t.land : t.apartment}</span>
            {(d.internet === 'included' || d.internet === 'available') && <span><Icon name="wifi" /> WiFi</span>}
          </div>
          {/* Public view count (same number the landlord sees in their
              library); hidden at zero rather than showing "0". */}
          {l.views > 0 && (
            <p className="muted" style={{ margin: '8px 0 0', fontWeight: 700 }}><Icon name="eye" /> {l.views.toLocaleString()} {t.viewsLabel}</p>
          )}
          {/* Share: WhatsApp first — it is how homes travel in Haiti. */}
          <ShareButtons
            url={`${(process.env.PUBLIC_BASE_URL || 'https://kayayiti.app').replace(/\/$/, '')}${base}/listings/${l.id}`}
            text={`${l.title} · ${previewText(l, t, params.locale).price} · ${previewText(l, t, params.locale).place}`}
            strings={t}
          />
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
          {taken ? (
            <p className="notice" style={{ margin: '22px 0 0' }}>
              {l.status === 'sold' ? t.soldNotice : t.leasedNotice}
            </p>
          ) : (
            <VisitScheduler listingId={l.id} owner={l.owner} strings={t} locale={params.locale} />
          )}
          <ReportListingButton listingId={l.id} owner={l.owner} strings={t} />
        </section>
        {!taken && (
          <div className="sticky-cta">
            <Link className="btn" href={`${base}/chats?listingId=${l.id}`}><Icon name="chat" /> {t.contact}</Link>
          </div>
        )}
      </main>
      <TabBar locale={params.locale} />
    </>
  );
}
