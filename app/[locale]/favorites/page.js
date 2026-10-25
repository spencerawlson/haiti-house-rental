'use client';

import { useEffect, useState, use } from 'react';
import { getDict } from '@/lib/dictionaries';
import { readFavorites } from '@/components/FavoriteButton';
import TabBar from '@/components/TabBar';
import ListingCard from '@/components/ListingCard';
import Icon from '@/components/Icon';

// Saved homes, kept in the browser until accounts exist.
export default function Favorites(props) {
  const params = use(props.params);
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
      <main className="container">
        <h1><Icon name="heart" /> {t.favorites}</h1>
        {listings === null && <p>...</p>}
        {listings?.length === 0 && <p>{t.favoritesEmpty}</p>}
        <div className="grid grid-2">
          {(listings || []).map((l) => (
            <ListingCard key={l.id} listing={l} locale={params.locale} t={t} />
          ))}
        </div>
      </main>
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
