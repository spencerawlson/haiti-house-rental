'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/account';

// Owner-only "take down" button: hides the listing from home, search and
// detail pages. Only renders when the signed-in user owns the listing;
// everyone else (and the admin, who uses the Admin Board) never sees it.
export default function TakeDownButton({ listingId, owner, locale, confirmText, label }) {
  const router = useRouter();
  const [mine, setMine] = useState(false);

  useEffect(() => {
    const session = getSession();
    setMine(!!session && !!owner && session.username === owner);
  }, [owner]);

  if (!mine) return null;

  async function takeDown() {
    if (!window.confirm(confirmText)) return;
    const res = await fetch('/api/listings/takedown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: listingId }),
    });
    if (res.ok) router.push(`/${locale}/listings`);
  }

  return (
    <button className="btn btn-secondary" type="button" onClick={takeDown} style={{ minHeight: 40, padding: '8px 16px' }}>
      {label}
    </button>
  );
}
