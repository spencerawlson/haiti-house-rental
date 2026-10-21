'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getDict } from '@/lib/dictionaries';
import { LOCALES } from '@/lib/config';
import { getMyAccount, signOut, markMyTransferSent } from '@/lib/account';
import TabBar from '@/components/TabBar';

// Centris-style Account screen. With a local account, it shows the profile;
// without one, it offers creation. No payment calculator — Haiti is a
// no-mortgage market.
export default function Account({ params }) {
  const t = getDict(params.locale);
  const [me, setMe] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [provider, setProvider] = useState('moncash');
  const [destination, setDestination] = useState({ moncashNumber: '', natcashNumber: '' });
  const [visits, setVisits] = useState([]);

  useEffect(() => {
    getMyAccount().then((a) => {
      setMe(a);
      setLoaded(true);
      if (a) {
        fetch(`/api/visits?username=${encodeURIComponent(a.username)}`)
          .then((r) => r.json())
          .then((d) => setVisits(d.visits || []))
          .catch(() => {});
      }
    });
    fetch('/api/settings').then((r) => r.json()).then(setDestination).catch(() => {});
  }, []);

  function logout() {
    signOut();
    setMe(null);
  }

  async function sentTransfer() {
    const data = await markMyTransferSent(provider);
    if (data?.account) setMe(data.account);
  }

  return (
    <>
      <main className="container">
        <h1>{t.account}</h1>
        {loaded && me && (
          <section className="card" style={{ marginBottom: 24 }}>
            <div className="card-body">
              <h2 style={{ margin: '0 0 8px' }}>{t.myProfile}</h2>
              <p style={{ margin: '0 0 4px' }}><strong>{me.name}</strong> · @{me.username} · {me.role === 'tenant' ? t.roleTenant : t.roleLandlord}</p>
              <p className="muted" style={{ margin: '0 0 4px' }}>{me.phone}{me.email ? ` · ${me.email}` : ''}</p>
              {me.location && (
                <p className="muted" style={{ margin: '0 0 12px' }}>📍 {me.location.commune}, {me.location.department}</p>
              )}
              {me.activated ? (
                <p style={{ color: '#15803d', fontWeight: 700 }}>✓ {t.accountActive}</p>
              ) : me.transferSent ? (
                <p>⏳ {t.waitingActivation}</p>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  <p style={{ margin: 0 }}>{t.accountPending} {t.sendTransfer}</p>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <label>
                      <input type="radio" checked={provider === 'moncash'} onChange={() => setProvider('moncash')} /> MonCash
                    </label>
                    <label>
                      <input type="radio" checked={provider === 'natcash'} onChange={() => setProvider('natcash')} /> NatCash
                    </label>
                  </div>
                  <p style={{ margin: 0 }}>{t.sendTo} <strong>{provider === 'natcash' ? (destination.natcashNumber || t.numberNotSet) : (destination.moncashNumber || t.numberNotSet)}</strong></p>
                  <button className="btn" type="button" onClick={sentTransfer} style={{ minHeight: 40, padding: '8px 16px' }}>{t.transferSent}</button>
                </div>
              )}
              <button className="btn btn-secondary" type="button" onClick={logout} style={{ minHeight: 40, padding: '8px 16px', marginTop: 12 }}>{t.signOut}</button>
            </div>
          </section>
        )}
        {loaded && !me && (
          <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn" href={`/${params.locale}/signup`}>{t.createAccount}</Link>
            <Link className="btn btn-secondary" href={`/${params.locale}/signin`}>{t.signIn}</Link>
          </p>
        )}
        <h2>{t.myActivity}</h2>
        <div className="grid">
          <Link href={`/${params.locale}/saved-searches`} className="card" style={{ color: 'inherit' }}>
            <div className="card-body">🔔 {t.savedSearches} <span style={{ float: 'right' }}>›</span></div>
          </Link>
          <Link href={`/${params.locale}/favorites`} className="card" style={{ color: 'inherit' }}>
            <div className="card-body">♥ {t.favorites} <span style={{ float: 'right' }}>›</span></div>
          </Link>
          <Link href={`/${params.locale}/near-me`} className="card" style={{ color: 'inherit' }}>
            <div className="card-body">📍 {t.nearMe} <span style={{ float: 'right' }}>›</span></div>
          </Link>
          <Link href={`/${params.locale}/list`} className="card" style={{ color: 'inherit' }}>
            <div className="card-body">＋ {t.postHome} <span style={{ float: 'right' }}>›</span></div>
          </Link>
        </div>
        <h2 style={{ marginTop: 32 }}>{t.myVisits}</h2>
        {loaded && me && visits.length === 0 && <p className="muted">{t.noVisits}</p>}
        <div className="grid">
          {visits.map((v) => (
            <Link key={v.id} href={`/${params.locale}/listings/${v.listingId}`} className="card" style={{ color: 'inherit' }}>
              <div className="card-body">
                <p style={{ margin: '0 0 4px' }}><strong>{v.listingTitle}</strong></p>
                <p className="muted" style={{ margin: 0 }}>
                  {v.date} · {v.time} — {v.status === 'confirmed' ? t.visitConfirmed : v.status === 'declined' ? t.visitDeclined : t.visitProposed}
                </p>
              </div>
            </Link>
          ))}
        </div>
        <h2 style={{ marginTop: 32 }}>{t.settings}</h2>
        <div className="card">
          <div className="card-body">
            <p style={{ margin: '0 0 8px' }}>{t.language}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {LOCALES.map((l) => (
                <Link key={l} className={l === params.locale ? 'btn' : 'btn btn-secondary'} href={`/${l}/account`} style={{ minHeight: 40, padding: '8px 16px' }}>
                  {l === 'ht' ? 'Kreyòl' : l === 'fr' ? 'Français' : 'English'}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 24 }}>{t.accountNote}</p>
      </main>
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
