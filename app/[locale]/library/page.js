'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getDict } from '@/lib/dictionaries';
import { getSession } from '@/lib/account';
import TabBar from '@/components/TabBar';

// A landlord's library: every home they ever posted, live and taken
// down, newest first. Live homes can be viewed, edited or taken down;
// taken-down homes can be put back online. Tenants see an empty library
// (they post nothing); signed-out visitors are pointed to sign-in.
export default function Library({ params }) {
  const t = getDict(params.locale);
  const [me, setMe] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [homes, setHomes] = useState([]);

  function load(username) {
    fetch(`/api/listings?owner=${encodeURIComponent(username)}&all=1`)
      .then((r) => r.json())
      .then((d) => setHomes(d.listings || []))
      .catch(() => {});
  }

  useEffect(() => {
    const session = getSession();
    setMe(session);
    setLoaded(true);
    if (session) load(session.username);
  }, []);

  async function takeDown(id) {
    if (!window.confirm(t.takeDownConfirm)) return;
    const res = await fetch('/api/listings/takedown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) load(me.username);
  }

  async function restore(id) {
    const res = await fetch('/api/listings/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) load(me.username);
  }

  return (
    <>
      <main className="container">
        <Link href={`/${params.locale}/account`}>← {t.account}</Link>
        <h1>{t.library}</h1>
        {loaded && !me && (
          <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn" href={`/${params.locale}/signup`}>{t.createAccount}</Link>
            <Link className="btn btn-secondary" href={`/${params.locale}/signin`}>{t.signIn}</Link>
          </p>
        )}
        {loaded && me && homes.length === 0 && <p className="muted">{t.noMyListings}</p>}
        <div className="grid">
          {homes.map((h) => (
            <section key={h.id} className="card">
              {h.photos?.length > 0 ? (
                <img src={h.photos[0]} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
              ) : (
                <div className="house-art" style={{ height: 120 }}>{h.commune}</div>
              )}
              <div className="card-body">
                <p style={{ margin: '0 0 4px' }}><strong>{h.title}</strong></p>
                <p className="muted" style={{ margin: '0 0 4px' }}>{h.commune} · {h.priceHTG.toLocaleString()} HTG</p>
                <p style={{ margin: '0 0 12px' }}>
                  {h.status === 'active' ? (
                    <span style={{ color: '#15803d', fontWeight: 700 }}>✓ {t.statusLive}</span>
                  ) : (
                    <span className="muted">{t.statusRemoved}</span>
                  )}
                </p>
                <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: 0 }}>
                  {h.status === 'active' && (
                    <>
                      <Link className="btn" href={`/${params.locale}/listings/${h.id}`} style={{ minHeight: 40, padding: '8px 16px' }}>{t.viewListing}</Link>
                      <Link className="btn btn-secondary" href={`/${params.locale}/listings/${h.id}/edit`} style={{ minHeight: 40, padding: '8px 16px' }}>{t.editListing}</Link>
                      <button className="btn btn-secondary" type="button" onClick={() => takeDown(h.id)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.takeDown}</button>
                    </>
                  )}
                  {h.status !== 'active' && (
                    <button className="btn" type="button" onClick={() => restore(h.id)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.restore}</button>
                  )}
                </p>
              </div>
            </section>
          ))}
        </div>
      </main>
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
