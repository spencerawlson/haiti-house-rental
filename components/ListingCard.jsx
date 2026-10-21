import Link from 'next/link';

export default function ListingCard({ listing, locale, t }) {
  return (
    <Link href={`/${locale}/listings/${listing.id}`} style={{ color: 'inherit' }}>
      <article className="card">
        {listing.photos?.length > 0 ? (
          <img src={listing.photos[0]} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
        ) : (
          <div className="house-art">{listing.commune}</div>
        )}
        <div className="card-body">
          <h3 style={{ margin: '0 0 4px' }}>{listing.title}</h3>
          <p className="muted" style={{ margin: '0 0 8px' }}>
            {listing.commune} · {listing.bedrooms} {t.bedrooms} · {listing.bathrooms} {t.bathrooms}
          </p>
          <p className="price" style={{ margin: 0 }}>
            {listing.priceHTG.toLocaleString()} HTG <span style={{ fontSize: '0.9rem', fontWeight: 400 }} className="muted">{t.perMonth}</span>
          </p>
        </div>
      </article>
    </Link>
  );
}
