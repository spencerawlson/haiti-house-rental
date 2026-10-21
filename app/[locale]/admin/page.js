'use client';

import { useEffect, useState } from 'react';
import { getDict } from '@/lib/dictionaries';
import { rentPeriodLabel } from '@/lib/listings';
import { DEPARTMENTS, departmentName } from '@/lib/departments';
import { hashPassword } from '@/lib/account';
import BackButton from '@/components/BackButton';

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
  const [partnerName, setPartnerName] = useState('');
  const [partnerUsername, setPartnerUsername] = useState('');
  const [partnerPassword, setPartnerPassword] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [partnerDepartment, setPartnerDepartment] = useState('ouest');
  const [partnerCommune, setPartnerCommune] = useState('');
  const [partnerMessage, setPartnerMessage] = useState('');

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

  async function createPartner(e) {
    e.preventDefault();
    setPartnerMessage('');
    const res = await fetch('/api/admin/partner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: partnerName.trim() || partnerUsername.trim(),
        username: partnerUsername.trim(),
        passwordHash: await hashPassword(partnerPassword),
        phone: partnerPhone.trim(),
        email: partnerEmail.trim(),
        location: { department: partnerDepartment, commune: partnerCommune },
      }),
    });
    if (res.status === 409) {
      setPartnerMessage(t.partnerExists);
      return;
    }
    if (!res.ok) {
      setPartnerMessage(t.partnerExists);
      return;
    }
    setPartnerMessage(t.partnerCreated);
    setPartnerName('');
    setPartnerUsername('');
    setPartnerPassword('');
    setPartnerPhone('');
    setPartnerEmail('');
    setPartnerCommune('');
    load();
  }

  return (
    <main className="container">
        <BackButton locale={params.locale} />
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
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <span className="chip">{t.totalUsers}: {accounts.length}</span>
        <span className="chip">{t.liveUsers}: {accounts.filter((a) => a.activated).length}</span>
        <span className="chip">{t.pendingUsers}: {accounts.filter((a) => !a.activated).length}</span>
      </div>
      <div className="grid">
        {accounts.map((a) => (
          <section key={a.username} className="card">
            <div className="card-body">
              <h3 style={{ margin: '0 0 4px' }}>{a.id ? `${a.id} · ` : ''}{a.name} · @{a.username} · {a.role === 'tenant' ? t.roleTenant : t.roleLandlord}{a.partner ? ` · 🤝 ${t.partner}` : ''}</h3>
              <p className="muted" style={{ margin: '0 0 4px' }}>
                {a.phone}{a.email ? ` · ${a.email}` : ''}{a.location ? ` · ${a.location.commune}, ${departmentName(a.location.department, params.locale)}` : ''}
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
      <h2 style={{ marginTop: 32 }}>{t.createPartnerAccount}</h2>
      <p className="muted">{t.partnerNote}</p>
      <form className="card" onSubmit={createPartner}>
        <div className="card-body" style={{ display: 'grid', gap: 14 }}>
          <div className="field"><label>{t.fullName}</label>
            <input className="input" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder={t.username} />
          </div>
          <div className="field"><label>{t.username}</label>
            <input className="input" value={partnerUsername} onChange={(e) => setPartnerUsername(e.target.value)} required />
          </div>
          <div className="field"><label>{t.password}</label>
            <input className="input" type="password" value={partnerPassword} onChange={(e) => setPartnerPassword(e.target.value)} required />
          </div>
          <div className="field"><label>{t.phoneLabel}</label>
            <input className="input" type="tel" value={partnerPhone} onChange={(e) => setPartnerPhone(e.target.value)} placeholder="+509 ____ ____" />
          </div>
          <div className="field"><label>{t.email}</label>
            <input className="input" type="email" value={partnerEmail} onChange={(e) => setPartnerEmail(e.target.value)} />
          </div>
          <div className="field"><label>{t.department}</label>
            <select className="input" value={partnerDepartment} onChange={(e) => { setPartnerDepartment(e.target.value); setPartnerCommune(''); }}>
              {DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.id}>{departmentName(d.id, params.locale)}</option>
              ))}
            </select>
          </div>
          <div className="field"><label>{t.commune}</label>
            <select className="input" value={partnerCommune} onChange={(e) => setPartnerCommune(e.target.value)} required>
              <option value=""></option>
              {(DEPARTMENTS.find((d) => d.id === partnerDepartment)?.communes || []).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <button className="btn" type="submit" style={{ minHeight: 40, padding: '8px 16px' }}>{t.createPartnerAccount}</button>
          {partnerMessage && <p style={{ margin: 0 }}>{partnerMessage}</p>}
        </div>
      </form>
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
