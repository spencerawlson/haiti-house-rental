'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSession } from '@/lib/account';

// Owner-only "edit" link to the listing's edit page. Only renders when
// the signed-in user owns the listing.
export default function EditListingButton({ listingId, owner, locale, label }) {
  const [mine, setMine] = useState(false);

  useEffect(() => {
    const session = getSession();
    setMine(!!session && !!owner && session.username === owner);
  }, [owner]);

  if (!mine) return null;

  return (
    <Link className="btn" href={`/${locale}/listings/${listingId}/edit`} style={{ minHeight: 40, padding: '8px 16px' }}>
      {label}
    </Link>
  );
}
