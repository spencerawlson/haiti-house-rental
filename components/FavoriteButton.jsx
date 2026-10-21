'use client';

import { useEffect, useState } from 'react';

// Centris-style favourite heart, saved in the browser (no account yet).
// The favourites page reads the same key.
export const FAV_KEY = 'kay-favorites';

export function readFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
  } catch {
    return [];
  }
}

export default function FavoriteButton({ listingId }) {
  const [fav, setFav] = useState(false);

  useEffect(() => {
    setFav(readFavorites().includes(listingId));
  }, [listingId]);

  function toggle(e) {
    e.preventDefault();
    const favs = readFavorites();
    const next = favs.includes(listingId)
      ? favs.filter((id) => id !== listingId)
      : [...favs, listingId];
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
    setFav(!fav);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="favorite"
      style={{
        position: 'absolute', top: 10, right: 10, zIndex: 1,
        width: 40, height: 40, borderRadius: '50%', border: '1px solid #e7e2dc',
        background: '#fff', fontSize: '1.2rem', cursor: 'pointer',
        color: fav ? '#dc2626' : '#9ca3af',
      }}
    >
      {fav ? '♥' : '♡'}
    </button>
  );
}
