'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSession } from '@/lib/account';
import { getDict } from '@/lib/dictionaries';

// Bottom tab bar (design: docs/design/app-showcase.png — Akèy, Rechèch,
// Favori, Mesaj, Kont). Labels come from the locale's dictionary, so the
// old per-page label props are ignored. The Messages tab carries the
// unread count. No payment calculator tab: Haiti is a no-mortgage market.
const ICONS = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  favorites: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  chat: <path d="M4 5h16v11H8l-4 4z" />,
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
};

export default function TabBar({ locale }) {
  const t = getDict(locale);
  const pathname = usePathname() || '';
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    async function refresh() {
      if (!getSession()) return;
      try {
        const res = await fetch('/api/chat/unread');
        if (res.ok) setUnread((await res.json()).total || 0);
      } catch {}
    }
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, []);
  const base = `/${locale}`;
  const active =
    pathname === `${base}/account` || pathname.startsWith(`${base}/library`) || pathname === `${base}/payments` || pathname === `${base}/visits` ? 'account'
    : pathname === `${base}/favorites` ? 'favorites'
    : pathname === `${base}/chats` ? 'chat'
    : pathname.startsWith(`${base}/listings`) ? 'search'
    : pathname === base || pathname === `${base}/` ? 'home'
    : '';
  const tabs = [
    { key: 'home', href: base, label: t.tabHome },
    { key: 'search', href: `${base}/listings`, label: t.tabSearch },
    { key: 'favorites', href: `${base}/favorites`, label: t.tabFavorites },
    { key: 'chat', href: `${base}/chats`, label: t.tabMessages },
    { key: 'account', href: `${base}/account`, label: t.tabAccount },
  ];
  return (
    <nav className="tabbar" aria-label={t.tabAccount}>
      {tabs.map((tab) => (
        <Link key={tab.key} href={tab.href} className={active === tab.key ? 'active' : ''} aria-current={active === tab.key ? 'page' : undefined}>
          <span className="tab-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{ICONS[tab.key]}</svg>
            {tab.key === 'chat' && unread > 0 && <span className="tab-badge">{unread > 99 ? '99+' : unread}</span>}
          </span>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
