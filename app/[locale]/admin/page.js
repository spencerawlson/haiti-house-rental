'use client';

import { useEffect, useState } from 'react';
import { getDict } from '@/lib/dictionaries';

// Admin: approve or remove featured placement. Nothing here is automatic —
// a landlord's featured checkbox is only a request until the admin approves.
// v0: this page has no login. Gate it before launch.
export default function Admin({ params }) {
  const t = getDict(params.locale);
  const [listings, setListings] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [moncashNumber, setMoncashNumber] = useState('');
  const [natcashNumber, setNatcashNumber] = useState('');
  const [numbersSaved, setNumbersSaved] = useState(false);

  async function load() {
    const res = await fetch('/api/listings');
    if (res.ok) {
      const data = await res.json();
      setListings(data.listings);
    }
    const ares = await fetch('/api/accounts');
    if (ares.ok) {
      const data = await ares.json();
      setAccounts(data.accounts);
    }
    const sres = await fetch('/api/settings');
    if (sres.ok) {
      const data = await sres.json();
      setMoncashNumber(data.moncashNumber || '');
      setNatcashNumber(data.natcashNumber || '');
    }
  }

  useEffect(() => { load(); }, []);

  async function saveNumbers(e) {
    e.preventDefault();
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moncashNumber, natcashNumber }),
    });
    setNumbersSaved(true);
  }

  async function set(id, featured) {
    await fetch('/api/admin/featured', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, featured }),
    });
    load();
  }

  async function setActivated(username, activated) {
    await fetch('/api/admin/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, activated }),
    });
    load();
  }

  return (
    <main className="container">
      <h1>{t.adminTitle}</h1>
      <p className="muted">{t.adminNote}</p>
      <h2>{t.paymentNumbers}</h2>
      <form className="card" onSubmit={saveNumbers}>
        <div className="card-body" style={{ display: 'grid', gap: 14 }}>
          <div className="field"><label>{t.moncashNumber}</label>
            <input className="input" type="tel" value={moncashNumber} onChange={(e) => setMoncashNumber(e.target.value)} placeholder="+509 ____ ____" />
          </div>
          <div className="field"><label>{t.natcashNumber}</label>
            <input className="input" type="tel" value={natcashNumber} onChange={(e) => setNatcashNumber(e.target.value)} placeholder="+509 ____ ____" />
          </div>
          <button className="btn" type="submit" style={{ minHeight: 40, padding: '8px 16px' }}>{t.saveNumbers}</button>
          {numbersSaved && <p style={{ margin: 0 }}>{t.numbersSaved}</p>}
        </div>
      </form>
      <h2 style={{ marginTop: 32 }}>{t.accountsTitle}</h2>
      <p className="muted">{t.accountsNote}</p>
      <div className="grid">
        {accounts.map((a) => (
          <section key={a.username} className="card">
            <div className="card-body">
              <h3 style={{ margin: '0 0 4px' }}>{a.name} · @{a.username}</h3>
              <p className="muted" style={{ margin: '0 0 4px' }}>
                {a.phone} · {a.email} · {a.location.commune}, {a.location.department}
              </p>
              <p className="muted" style={{ margin: '0 0 8px' }}>
                {a.activated ? `✓ ${t.accountActive}` : a.transferSent ? `⏳ ${t.transferFrom} ${a.phone} ${t.viaProvider} ${a.transferProvider === 'natcash' ? 'NatCash' : 'MonCash'}` : t.accountPending}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                {!a.activated && (
                  <button className="btn" type="button" onClick={() => setActivated(a.username, true)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.activateAccount}</button>
                )}
                {a.activated && (
                  <button className="btn btn-secondary" type="button" onClick={() => setActivated(a.username, false)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.deactivateAccount}</button>
                )}
              </div>
            </div>
          </section>
        ))}
        {accounts.length === 0 && <p className="muted">{t.noAccounts}</p>}
      </div>
      <h2 style={{ marginTop: 32 }}>{t.featuredTitle || t.adminTitle}</h2>
      <div className="grid">
        {listings.map((l) => (
          <section key={l.id} className="card">
            <div className="card-body">
              <h3 style={{ margin: '0 0 4px' }}>{l.title}</h3>
              <p className="muted" style={{ margin: '0 0 8px' }}>
                {l.commune} · {l.priceHTG.toLocaleString()} HTG
                {l.purpose === 'rent' ? ` ${t.perMonth}` : ''}
                {l.featured && <> · <span className="badge">★ {t.featured}</span></>}
                {l.featuredRequested && !l.featured && <> · <span className="badge">{t.requestedBadge}</span></>}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                {!l.featured && (
                  <button className="btn" type="button" onClick={() => set(l.id, true)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.approveFeatured}</button>
                )}
                {l.featured && (
                  <button className="btn btn-secondary" type="button" onClick={() => set(l.id, false)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.removeFeatured}</button>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
