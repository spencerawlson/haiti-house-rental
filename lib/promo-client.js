'use client';

import { useEffect, useState } from 'react';

// Promo counts for client pages ({ spots, remaining }), or null until
// loaded or when the request fails — callers then show normal prices.
export function usePromo() {
  const [promo, setPromo] = useState(null);
  useEffect(() => {
    let live = true;
    fetch('/api/promo')
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => { if (live) setPromo(p); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return promo;
}
