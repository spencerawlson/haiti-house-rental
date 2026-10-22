'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSession } from '@/lib/account';

// The bell on Home: opens the notifications inbox, with the unread count.
export default function NotificationBell({ locale, label }) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!getSession()) return;
    fetch('/api/notifications').then((r) => r.json()).then((d) => setUnread(d.unread || 0)).catch(() => {});
  }, []);
  return (
    <Link href={`/${locale}/notifications`} className="icon-btn" aria-label={label}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 21h4" /></svg>
      {unread > 0 && <span className="tab-badge" style={{ top: -2, right: -2 }}>{unread > 99 ? '99+' : unread}</span>}
    </Link>
  );
}
