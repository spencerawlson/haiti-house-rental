'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getDict } from '@/lib/dictionaries';
import { LOCALES } from '@/lib/config';
import { departmentName, communeName } from '@/lib/departments';
import { getMyAccount, signOut, markMyTransferSent } from '@/lib/account';
import TabBar from '@/components/TabBar';
import ThemeToggle from '@/components/ThemeToggle';

// Centris-style Account screen. With a local account, it shows the profile;
// without one, it offers creation.
export default function Account({ params }) {
  const t = getDict(params.locale);
  const [me, setMe] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [provider, setProvider] = useState('moncash');
  const [destination, setDestination] = useState({ moncashNumber: '', natcashNumber: '' });
  const [visits, setVisits] = useState([]);
  const [threads, setThreads] = useState([]);
  const [myHomes, setMyHomes] = useState([]);

  useEffect(() => {
    getMyAccount().then((a) => {
      setMe(a);
      setLoaded(true);
      if (a) {
        fetch(`/api/visits?username=${encodeURIComponent(a.username)}`)
          .then((r) => r.json())
          .then((d) => setVisits(d.visits || []))
          .catch(() => {});
        fetch(`/api/chat/inbox?username=${encodeURIComponent(a.username)}`)
          .then((r) => r.json())
          .then((d) => setThreads(d.threads || []))
          .catch(() => {});
        fetch(`/api/listings?owner=${encodeURIComponent(a.username)}`)
          .then((r) => r.json())
          .then((d) => setMyHomes(d.listings || []))
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

  async function takeDownHome(id) {
    if (!window.confirm(t.takeDownConfirm)) return;
    const res = await fetch('/api/listings/takedown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, username: me?.username }),
    });
    if (res.ok) setMyHomes((homes) => homes.filter((h) => h.id !== id));
  }

  async function deleteThread(id) {
    if (!window.confirm(t.deleteChatConfirm)) return;
    await fetch('/api/chat/hide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId: id, username: me?.username }),
    });
    setThreads((prev) => prev.filter((th) => th.listingId !== id));
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
              {me.id && <p className="muted" style={{ margin: '0 0 4px' }}>{t.accountId}: {me.id}</p>}
              <p className="muted" style={{ margin: '0 0 4px' }}>{me.phone}{me.email ? ` · ${me.email}` : ''}</p>
              {me.location && (
                <p className="muted" style={{ margin: '0 0 12px' }}>📍 {communeName(me.location.commune, params.locale)}, {departmentName(me.location.department, params.locale)}</p>
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
          {(!me || me.role !== 'tenant') && (
          <Link href={`/${params.locale}/list`} className="card" style={{ color: 'inherit' }}>
            <div className="card-body">＋ {t.postHome} <span style={{ float: 'right' }}>›</span></div>
          </Link>
          )}
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
        <h2 style={{ marginTop: 32 }}>{t.myMessages}</h2>
        {loaded && me && threads.length === 0 && <p className="muted">{t.noMessages}</p>}
        <div className="grid">
          {threads.map((th) => (
            <section key={th.listingId} className="card">
              <div className="card-body">
                <p style={{ margin: '0 0 2px' }}>
                  <Link href={`/${params.locale}/chats?listingId=${th.listingId}`}>{th.otherName || th.listingTitle}</Link>
                  {th.unread > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, height: 20, padding: '0 5px', borderRadius: 999, background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 800, marginLeft: 8 }}>
                      {th.unread}
                    </span>
                  )}
                </p>
                {th.otherName && <p className="muted" style={{ margin: '0 0 4px' }}>{th.listingTitle}</p>}
                <p className="muted" style={{ margin: '0 0 12px' }}>{th.lastText}</p>
                <button className="btn btn-secondary" type="button" onClick={() => deleteThread(th.listingId)} style={{ minHeight: 40, padding: '8px 16px' }}>🗑️ {t.deleteChat}</button>
              </div>
            </section>
          ))}
        </div>
        {loaded && me && me.role !== 'tenant' && (
          <>
            <h2 style={{ marginTop: 32 }}>{t.myListings}</h2>
            <p style={{ marginTop: -8 }}><Link href={`/${params.locale}/library`}>{t.library} ›</Link></p>
            {myHomes.length === 0 && <p className="muted">{t.noMyListings}</p>}
            <div className="grid">
              {myHomes.map((h) => (
                <section key={h.id} className="card">
                  <div className="card-body">
                    <p style={{ margin: '0 0 4px' }}><Link href={`/${params.locale}/listings/${h.id}`}>{h.title}</Link></p>
                    <p className="muted" style={{ margin: '0 0 12px' }}>{h.commune} · {h.priceHTG.toLocaleString()} HTG</p>
                    <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: 0 }}>
                      <Link className="btn" href={`/${params.locale}/listings/${h.id}/edit`} style={{ minHeight: 40, padding: '8px 16px' }}>{t.editListing}</Link>
                      <button className="btn btn-secondary" type="button" onClick={() => takeDownHome(h.id)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.takeDown}</button>
                    </p>
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
        <h2 style={{ marginTop: 32 }}>{t.settings}</h2>
        <div className="card">
          <div className="card-body">
            <p style={{ margin: '0 0 8px' }}>{t.language}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {LOCALES.map((l) => (
                <Link
                  key={l}
                  className={l === params.locale ? 'btn' : 'btn btn-secondary'}
                  href={`/${l}/account`}
                  style={{ minHeight: 40, padding: '8px 16px' }}
                  onClick={() => {
                    document.cookie = `kay_locale=${l}; path=/; max-age=31536000`;
                    try { localStorage.setItem('kay_locale', l); } catch {}
                  }}
                >
                  {l === 'ht' ? 'Kreyòl' : l === 'fr' ? 'Français' : 'English'}
                </Link>
              ))}
            </div>
            <p style={{ margin: '16px 0 8px' }}>{t.theme}</p>
            <ThemeToggle lightLabel={t.themeLight} darkLabel={t.themeDark} />
          </div>
        </div>
      </main>
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
