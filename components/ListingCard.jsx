import Link from 'next/link';
import FavoriteButton from './FavoriteButton';
import { rentPeriodLabel } from '@/lib/listings';
import { communeName } from '@/lib/departments';

// Listing card (design: docs/design/app-showcase.png, screen 4): photo
// with the heart on top, title, place, blue price with its rent period,
// then a small row of rooms / wifi / parking.
export default function ListingCard({ listing, locale, t }) {
  const d = listing.details || {};
  return (
    <article className="lcard">
      <FavoriteButton listingId={listing.id} />
      <Link href={`/${locale}/listings/${listing.id}`}>
        {listing.photos?.length > 0 ? (
          <img className="lcard-photo" src={listing.photos[0]} alt="" loading="lazy" decoding="async" />
        ) : (
          <div className="lcard-art">{communeName(listing.commune, locale)}</div>
        )}
        <div className="lcard-body">
          <h3 className="lcard-title">{listing.title}</h3>
          <p className="lcard-place">{communeName(listing.commune, locale)}</p>
          <p className="lcard-price">
            {listing.priceHTG.toLocaleString()} HTG
            {listing.purpose === 'rent' && <small> {rentPeriodLabel(listing.rentPeriod, t)}</small>}
          </p>
          <div className="icon-row">
            {listing.type === 'land' ? (
              <span>📐 {listing.areaM2 ? `${listing.areaM2.toLocaleString()} m²` : t.land}</span>
            ) : (
              <>
                <span title={t.bedrooms}>🛏 {listing.bedrooms}</span>
                <span title={t.bathrooms}>🛁 {listing.bathrooms}</span>
              </>
            )}
            {(d.internet === 'included' || d.internet === 'available') && <span>📶 WiFi</span>}
            {d.power24 && <span>⚡ 24/24</span>}
            {d.parking > 0 && <span>🚗 {d.parking}</span>}
            {listing.views > 0 && <span title={t.viewsLabel}>👁 {listing.views.toLocaleString()}</span>}
          </div>
          {(listing.verified || listing.advertised || listing.status === 'sold' || listing.status === 'leased') && (
            <div className="lcard-badges">
              {(listing.status === 'sold' || listing.status === 'leased') && (
                <span className="badge-taken">🏷 {listing.status === 'sold' ? t.statusSold : t.statusLeased}</span>
              )}
              {listing.verified && <span className="badge-verified">✓ {t.verifiedListing}</span>}
              {listing.advertised && <span className="badge">📣 {t.advertised}</span>}
            </div>
          )}
        </div>
      </Link>
    </article>
  );
}
