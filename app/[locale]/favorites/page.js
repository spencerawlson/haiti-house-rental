'use client';

import { useEffect, useState } from 'react';
import { getDict } from '@/lib/dictionaries';
import { readFavorites } from '@/components/FavoriteButton';
import Header from '@/components/Header';
import ListingCard from '@/components/ListingCard';

// Saved homes, kept in the browser until accounts exist.
export default function Favorites({ params }) {
  const t = getDict(params.locale);
  const [listings, setListings] = useState(null);

  useEffect(() => {
    const favs = readFavorites();
    fetch('/api/listings')
      .then((r) => r.json())
      .then((d) => setListings(d.listings.filter((l) => favs.includes(l.id))))
      .catch(() => setListings([]));
  }, []);

  return (
    <>
      <Header locale={params.locale} browse={t.browse} listHome={t.listHome} favorites={t.favorites} />
      <main className="container">
        <h1>♥ {t.favorites}</h1>
        {listings === null && <p>...</p>}
        {listings?.length === 0 && <p>{t.favoritesEmpty}</p>}
        <div className="grid grid-2">
          {(listings || []).map((l) => (
            <ListingCard key={l.id} listing={l} locale={params.locale} t={t} />
          ))}
        </div>
      </main>
    </>
  );
}
