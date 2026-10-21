import Link from 'next/link';
import FavoriteButton from './FavoriteButton';
import { rentPeriodLabel } from '@/lib/listings';

export default function ListingCard({ listing, locale, t }) {
  return (
    <article className="card" style={{ position: 'relative' }}>
      <FavoriteButton listingId={listing.id} />
      <Link href={`/${locale}/listings/${listing.id}`} style={{ color: 'inherit' }}>
        {listing.photos?.length > 0 ? (
          <img src={listing.photos[0]} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
        ) : (
          <div className="house-art">{listing.commune}</div>
        )}
        <div className="card-body">
          <p className="price" style={{ margin: '0 0 4px' }}>
            {listing.priceHTG.toLocaleString()} HTG {listing.purpose === 'rent' && <span style={{ fontSize: '0.9rem', fontWeight: 400 }} className="muted">{rentPeriodLabel(listing.rentPeriod, t)}</span>}
          </p>
          {listing.advertised && <p style={{ margin: '0 0 4px' }}><span className="badge">📣 {t.advertised}</span></p>}
          <h3 style={{ margin: '0 0 4px' }}>{listing.title}</h3>
          <p className="muted" style={{ margin: 0 }}>
            {listing.commune} · {listing.type === 'land'
              ? (listing.areaM2 ? `${listing.areaM2.toLocaleString()} m²` : t.land)
              : `${listing.bedrooms} ${t.bedrooms} · ${listing.bathrooms} ${t.bathrooms}`}
            {listing.photos?.length > 0 && ` · ${listing.photos.length} 📷`}
            {listing.videos?.length > 0 && ` · ${listing.videos.length} 🎬`}
          </p>
        </div>
      </Link>
    </article>
  );
}
