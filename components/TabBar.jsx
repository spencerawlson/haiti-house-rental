'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSession } from '@/lib/account';

// Centris-style bottom tab bar. Active tab gets the light-blue pill.
// The Account tab carries the unread-message count: when a tenant writes
// about one of your homes (or a landlord replies to you), the badge tells
// you without opening every listing.
// No payment calculator tab: Haiti is a no-mortgage market.
export default function TabBar({ locale, browse, favorites, explore, account }) {
  const pathname = usePathname() || '';
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    async function refresh() {
      const session = getSession();
      if (!session) return;
      try {
        const res = await fetch(`/api/chat/unread?username=${encodeURIComponent(session.username)}`);
        if (res.ok) setUnread((await res.json()).total || 0);
      } catch {}
    }
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, []);
  const base = `/${locale}`;
  const active =
    pathname === `${base}/account` ? 'account'
    : pathname === `${base}/favorites` ? 'favorites'
    : pathname.startsWith(`${base}/listings`) ? 'search'
    : pathname === base || pathname === `${base}/` ? 'explore'
    : '';
  const tabs = [
    { key: 'search', href: `${base}/listings`, icon: '🔍', label: browse },
    { key: 'favorites', href: `${base}/favorites`, icon: '♥', label: favorites },
    { key: 'explore', href: base, icon: '🧭', label: explore },
    { key: 'account', href: `${base}/account`, icon: '👤', label: account },
  ];
  return (
    <nav className="tabbar">
      {tabs.map((tab) => (
        <Link key={tab.key} href={tab.href} className={active === tab.key ? 'active' : ''}>
          <span className="tab-icon">{tab.icon}</span>
          {tab.label}
          {tab.key === 'account' && unread > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, height: 20, padding: '0 5px', borderRadius: 999, background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 800, marginLeft: 4 }}>
              {unread}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
