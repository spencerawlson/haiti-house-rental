'use client';

import { useEffect, useState } from 'react';
import { getDict } from '@/lib/dictionaries';
import { rentPeriodLabel } from '@/lib/listings';

// Admin: approve or remove advertising, track activation revenue, and
// convert it. Nothing here is automatic — a landlord's advertising
// checkbox is only a request until the admin approves, and revenue is
// logged only when the admin activates an account.
export default function Admin({ params }) {
  const t = getDict(params.locale);
  const [listings, setListings] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [revenue, setRevenue] = useState({ entries: [], totalHTG: 0 });
  const [rates, setRates] = useState(null);
  const [rateError, setRateError] = useState(false);
  const [convertAmount, setConvertAmount] = useState('');
  const [moncashNumber, setMoncashNumber] = useState('');
  const [natcashNumber, setNatcashNumber] = useState('');
  const [numbersSaved, setNumbersSaved] = useState(false);

  async function loadRates(fresh) {
    const res = await fetch(`/api/rates${fresh ? '?fresh=1' : ''}`);
    if (res.ok) {
      setRates(await res.json());
      setRateError(false);
    } else {
      setRateError(true);
    }
  }

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
    const rres = await fetch('/api/admin/revenue');
    if (rres.ok) {
      const data = await rres.json();
      setRevenue(data);
      if (!convertAmount) setConvertAmount(String(data.totalHTG));
    }
    const sres = await fetch('/api/settings');
    if (sres.ok) {
      const data = await sres.json();
      setMoncashNumber(data.moncashNumber || '');
      setNatcashNumber(data.natcashNumber || '');
    }
  }

  useEffect(() => { load(); loadRates(false); }, []);

  async function saveNumbers(e) {
    e.preventDefault();
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moncashNumber, natcashNumber }),
    });
    setNumbersSaved(true);
  }

  async function set(id, advertised) {
    await fetch('/api/admin/advertised', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, advertised }),
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
              <h3 style={{ margin: '0 0 4px' }}>{a.name} · @{a.username} · {a.role === 'tenant' ? t.roleTenant : t.roleLandlord}</h3>
              <p className="muted" style={{ margin: '0 0 4px' }}>
                {a.phone}{a.email ? ` · ${a.email}` : ''}{a.location ? ` · ${a.location.commune}, ${a.location.department}` : ''}
              </p>
              <p className="muted" style={{ margin: '0 0 8px' }}>
                {a.activated ? `✓ ${t.accountActive}` : a.transferSent ? `⏳ ${t.transferFrom} ${a.phone} ${t.viaProvider} ${a.transferProvider === 'natcash' ? 'NatCash' : 'MonCash'}` : t.accountPending}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                {a.role !== 'tenant' && !a.activated && (
                  <button className="btn" type="button" onClick={() => setActivated(a.username, true)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.activateAccount}</button>
                )}
                {a.role !== 'tenant' && a.activated && (
                  <button className="btn btn-secondary" type="button" onClick={() => setActivated(a.username, false)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.deactivateAccount}</button>
                )}
              </div>
            </div>
          </section>
        ))}
        {accounts.length === 0 && <p className="muted">{t.noAccounts}</p>}
      </div>
      <h2 style={{ marginTop: 32 }}>{t.revenueTitle}</h2>
      <div className="card">
        <div className="card-body">
          <p style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 4px' }}>{revenue.totalHTG.toLocaleString()} HTG</p>
          <p className="muted" style={{ margin: '0 0 4px' }}>{t.revenueNote}</p>
          <p className="muted" style={{ margin: 0 }}>{t.revenueStartNote}</p>
        </div>
      </div>
      <h3 style={{ marginTop: 24 }}>{t.activationsTitle}</h3>
      <div className="grid">
        {revenue.entries.map((e) => (
          <section key={e.username} className="card">
            <div className="card-body">
              <p style={{ margin: '0 0 4px' }}><strong>{e.name}</strong> · @{e.username}</p>
              <p className="muted" style={{ margin: 0 }}>
                {new Date(e.activatedAt).toLocaleDateString(params.locale)} · {e.amountHTG.toLocaleString()} HTG
              </p>
            </div>
          </section>
        ))}
        {revenue.entries.length === 0 && <p className="muted">{t.noActivations}</p>}
      </div>
      <h2 style={{ marginTop: 32 }}>{t.converterTitle}</h2>
      <div className="card">
        <div className="card-body" style={{ display: 'grid', gap: 12 }}>
          <div className="field"><label>{t.converterAmount}</label>
            <input className="input" type="number" value={convertAmount} onChange={(e) => setConvertAmount(e.target.value)} />
          </div>
          {rates && Number(convertAmount) > 0 && (
            <div>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 4px' }}>
                {(Number(convertAmount) / rates.htgPerUsd).toFixed(2)} USD
              </p>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px' }}>
                {(Number(convertAmount) / rates.htgPerCad).toFixed(2)} CAD
              </p>
              <p className="muted" style={{ margin: 0 }}>
                1 USD = {rates.htgPerUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })} HTG · 1 CAD = {rates.htgPerCad.toLocaleString(undefined, { maximumFractionDigits: 2 })} HTG
                {rates.updated ? ` · ${t.rateUpdated} ${rates.updated} (${rates.source})` : ''}
              </p>
            </div>
          )}
          {rateError && <p className="muted" style={{ margin: 0 }}>{t.rateUnavailable}</p>}
          <div>
            <button className="btn btn-secondary" type="button" onClick={() => loadRates(true)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.refreshRate}</button>
          </div>
        </div>
      </div>
      <h2 style={{ marginTop: 32 }}>{t.advertisedTitle || t.adminTitle}</h2>
      <div className="grid">
        {listings.map((l) => (
          <section key={l.id} className="card">
            <div className="card-body">
              <h3 style={{ margin: '0 0 4px' }}>{l.title}</h3>
              <p className="muted" style={{ margin: '0 0 8px' }}>
                {l.commune} · {l.priceHTG.toLocaleString()} HTG
                {l.purpose === 'rent' ? ` ${rentPeriodLabel(l.rentPeriod, t)}` : ''}
                {l.advertised && <> · <span className="badge">📣 {t.advertised}</span></>}
                {l.advertisedRequested && !l.advertised && <> · <span className="badge">{t.advertisedRequestedBadge}</span></>}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                {!l.advertised && (
                  <button className="btn" type="button" onClick={() => set(l.id, true)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.approveAdvertised}</button>
                )}
                {l.advertised && (
                  <button className="btn btn-secondary" type="button" onClick={() => set(l.id, false)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.removeAdvertised}</button>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
