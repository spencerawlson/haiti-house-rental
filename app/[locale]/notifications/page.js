'use client';

import Link from 'next/link';
import { useEffect, useState, use } from 'react';
import { getDict } from '@/lib/dictionaries';
import { getSession } from '@/lib/account';
import TabBar from '@/components/TabBar';
import BackButton from '@/components/BackButton';
import Icon from '@/components/Icon';

// Notifications inbox: visit requests and answers, payment decisions.
// Opening it marks everything read.
const ICON = { visit_proposed: 'calendar', visit_confirmed: 'check', visit_declined: 'x', visit_cancelled: 'ban', visit_rescheduled: 'repeat', payment_confirmed: 'card', payment_rejected: 'warning', chat: 'chat' };

export default function Notifications(props) {
  const params = use(props.params);
  const t = getDict(params.locale);
  const [items, setItems] = useState(null);
  const [signedIn, setSignedIn] = useState(true);

  useEffect(() => {
    if (!getSession()) {
      setSignedIn(false);
      setItems([]);
      return;
    }
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((d) => {
        setItems(d.notifications || []);
        if (d.unread > 0) fetch('/api/notifications/read', { method: 'POST' }).catch(() => {});
      })
      .catch(() => setItems([]));
  }, []);

  const text = (n) => (t[`notif_${n.kind}`] || n.kind).replace(/\{(\w+)\}/g, (_, k) => String(n.params?.[k] ?? ''));
  const href = (n) => (n.link ? n.link.replace(/^\/(ht|fr|en)\//, `/${params.locale}/`) : null);

  return (
    <>
      <main className="container">
        <BackButton locale={params.locale} />
        <h1 className="page-title"><Icon name="bell" /> {t.notificationsTitle}</h1>
        {!signedIn && <p><Link className="btn" href={`/${params.locale}/signin`}>{t.signIn}</Link></p>}
        {items && signedIn && items.length === 0 && <p className="muted">{t.noNotifications}</p>}
        <nav className="menu card">
          {(items || []).map((n) => {
            const body = (
              <>
                <span className="menu-icon" aria-hidden="true"><Icon name={ICON[n.kind] || 'bell'} /></span>
                <span style={{ flex: 1, fontWeight: n.read ? 400 : 800 }}>
                  {text(n)}
                  <span className="muted" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 400 }}>{new Date(n.createdAt).toLocaleString(params.locale === 'ht' ? 'fr' : params.locale)}</span>
                </span>
              </>
            );
            return href(n)
              ? <Link key={n.id} href={href(n)} className="menu-row">{body}</Link>
              : <div key={n.id} className="menu-row">{body}</div>;
          })}
        </nav>
      </main>
      <TabBar locale={params.locale} />
    </>
  );
}
