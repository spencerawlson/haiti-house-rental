'use client';

import { useEffect } from 'react';
import { visitorId } from '@/lib/account';

// Counts one view of a listing's detail page, so its landlord can see how
// many people looked at the home. Fires once per mount from the browser
// rather than from the server render, because the page is force-dynamic:
// counting during render would also count Next's own prefetches and every
// back-button return, and the number would mean nothing.
//
// The server decides what actually counts (never the owner, once per
// viewer per half hour). Failure is silent — a view that goes uncounted
// must never disturb someone reading a listing.
export default function ViewPing({ listingId }) {
  useEffect(() => {
    if (!listingId) return;
    fetch('/api/listings/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: listingId, visitor: visitorId() }),
      keepalive: true,
    }).catch(() => {});
  }, [listingId]);
  return null;
}
