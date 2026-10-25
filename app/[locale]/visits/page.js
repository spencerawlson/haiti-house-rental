'use client';

import Link from 'next/link';
import { useEffect, useState, use } from 'react';
import { getDict } from '@/lib/dictionaries';
import { getSession } from '@/lib/account';
import TabBar from '@/components/TabBar';
import BackButton from '@/components/BackButton';
import Icon from '@/components/Icon';

// My visits — every visit where I am the tenant or the listing owner,
// upcoming first. Actions (confirm, reschedule, cancel) stay on the
// listing page, next to the calendar.
export default function Visits(props) {
  const params = use(props.params);
  const t = getDict(params.locale);
  const [me, setMe] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [visits, setVisits] = useState([]);

  useEffect(() => {
    const session = getSession();
    setMe(session);
    if (!session) {
      setLoaded(true);
      return;
    }
    fetch('/api/visits')
      .then((r) => r.json())
      .then((d) => setVisits(d.visits || []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const active = (v) => ['proposed', 'confirmed'].includes(v.status);
  const sorted = [...visits].sort((a, b) => (active(b) - active(a)) || `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const label = (v) => (v.status === 'confirmed' ? t.visitConfirmed : v.status === 'declined' ? t.visitDeclined : v.status === 'cancelled' ? t.visitCancelled : t.visitProposed);

  return (
    <>
      <main className="container">
        <BackButton locale={params.locale} />
        <h1 className="page-title"><Icon name="calendar" /> {t.myVisits}</h1>
        {loaded && !me && (
          <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn" href={`/${params.locale}/signin`}>{t.signIn}</Link>
            <Link className="btn btn-secondary" href={`/${params.locale}/signup`}>{t.createAccount}</Link>
          </p>
        )}
        {loaded && me && sorted.length === 0 && <p className="muted">{t.noVisits}</p>}
        <div className="grid">
          {sorted.map((v) => (
            <Link key={v.id} href={`/${params.locale}/listings/${v.listingId}`} className="card" style={{ color: 'inherit', opacity: active(v) ? 1 : 0.7 }}>
              <div className="card-body" style={{ display: 'grid', gap: 4 }}>
                <p style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>{v.date} · {v.time}</strong>
                  <span className={`status-pill ${v.status}`}>{label(v)}</span>
                </p>
                <p style={{ margin: 0 }}>{v.listingTitle}</p>
                <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
                  {me && v.owner === me.username ? `${t.roleLandlord} · @${v.tenant}` : `${t.roleTenant}`}
                  {v.status === 'proposed' && ((me && v.owner === me.username) ? v.proposedBy === 'tenant' : v.proposedBy === 'owner') ? <> · <Icon name="hourglass" /> {t.visitNeedsYou}</> : ''}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <TabBar locale={params.locale} />
    </>
  );
}
