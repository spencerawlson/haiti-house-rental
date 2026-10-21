'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Centris-style bottom tab bar. Active tab gets the light-blue pill.
// No payment calculator tab: Haiti is a no-mortgage market.
export default function TabBar({ locale, browse, favorites, explore, account }) {
  const pathname = usePathname() || '';
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
        </Link>
      ))}
    </nav>
  );
}
