'use client';

import { useEffect, useState, use } from 'react';
import { getDict } from '@/lib/dictionaries';
import { rentPeriodLabel } from '@/lib/listings';
import { DEPARTMENTS, departmentName, communeName } from '@/lib/departments';
import { hashPassword } from '@/lib/account';
import BackButton from '@/components/BackButton';

// Admin: approve or remove advertising, track activation revenue, and
// convert it. Nothing here is automatic — a landlord's advertising
// checkbox is only a request until the admin approves, and revenue is
// logged only when the admin activates an account.
export default function Admin(props) {
  const params = use(props.params);
  const t = getDict(params.locale);
  const [listings, setListings] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [resetCodes, setResetCodes] = useState({});
  const [reports, setReports] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paySummary, setPaySummary] = useState(null);
  const [auditEntries, setAuditEntries] = useState([]);
  const [channels, setChannels] = useState(null);
  const [reportThreads, setReportThreads] = useState({});
  const [revenue, setRevenue] = useState({ entries: [], totalHTG: 0 });
  const [rates, setRates] = useState(null);
  const [rateError, setRateError] = useState(false);
  const [convertAmount, setConvertAmount] = useState('');
  const [moncashNumber, setMoncashNumber] = useState('');
  const [natcashNumber, setNatcashNumber] = useState('');
  const [numbersSaved, setNumbersSaved] = useState(false);
  const [presence, setPresence] = useState({ users: [], visitors: 0 });
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
    const payres = await fetch('/api/admin/payments');
    if (payres.ok) {
      const data = await payres.json();
      setPayments(data.payments || []);
      setPaySummary(data.summary);
    }
    const chres = await fetch('/api/admin/notify-status');
    if (chres.ok) setChannels(await chres.json());
    const audres = await fetch('/api/admin/audit');
    if (audres.ok) setAuditEntries((await audres.json()).entries || []);
    const repres = await fetch('/api/admin/reports');
    if (repres.ok) setReports((await repres.json()).reports || []);
    const sres = await fetch('/api/settings');
    if (sres.ok) {
      const data = await sres.json();
      setMoncashNumber(data.moncashNumber || '');
      setNatcashNumber(data.natcashNumber || '');
    }
  }

  useEffect(() => {
    load();
    loadRates(false);
    loadPresence();
    const pid = setInterval(loadPresence, 30000);
    return () => clearInterval(pid);
  }, []);

  async function loadPresence() {
    const res = await fetch('/api/admin/presence');
    if (res.ok) setPresence(await res.json());
  }

  async function saveNumbers(e) {
    e.preventDefault();
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moncashNumber, natcashNumber }),
    });
    setNumbersSaved(true);
  }

  // Verification is a human check (visit, documents, owner identity) —
  // never automatic for paying accounts.
  async function setVerifiedListing(id, verified) {
    if (verified && !window.confirm(t.verifyConfirm)) return;
    await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, verified }),
    });
    load();
  }

  async function set(id, advertised) {
    await fetch('/api/admin/advertised', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, advertised }),
    });
    load();
  }

  // Confirm only after matching the reference and amount on the
  // MonCash/NatCash statement. A confirmation activates the account or
  // starts/extends advertising, exactly once.
  async function reviewPayment(p, decision) {
    let note = '';
    if (decision === 'confirmed' && !window.confirm(`${t.payConfirmPrompt}
${p.reference} · ${p.amountHTG.toLocaleString()} HTG`)) return;
    if (decision === 'rejected') {
      note = window.prompt(t.payRejectPrompt) ?? null;
      if (note === null) return;
    }
    await fetch('/api/admin/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, decision, note }),
    });
    load();
  }

  // Moderator view of a reported conversation (toggle).
  async function viewReportedThread(report) {
    if (reportThreads[report.id]) {
      setReportThreads((prev) => ({ ...prev, [report.id]: null }));
      return;
    }
    const res = await fetch(`/api/admin/conversation?id=${encodeURIComponent(report.targetId)}`);
    if (res.ok) {
      const data = await res.json();
      setReportThreads((prev) => ({ ...prev, [report.id]: data }));
    }
  }

  async function resolveReport(id) {
    await fetch('/api/admin/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setReports((prev) => prev.filter((r) => r.id !== id));
  }

  async function takeDown(id) {
    if (!window.confirm(t.takeDownConfirm)) return;
    await fetch('/api/listings/takedown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
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

  // Admin-assisted recovery: confirm who is asking (call back the phone
  // on the account) before reading the code to them.
  async function issueResetCode(username) {
    if (!window.confirm(t.resetCodeConfirm)) return;
    const res = await fetch('/api/admin/reset-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    if (res.ok) {
      const data = await res.json();
      setResetCodes((prev) => ({ ...prev, [username]: data.code }));
    }
  }

  async function adminLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = `/${params.locale}/admin-login`;
  }

  return (
    <main className="container">
        <BackButton locale={params.locale} />
      <h1>{t.adminTitle}</h1>
      <p><button className="btn btn-secondary" type="button" onClick={adminLogout} style={{ minHeight: 40, padding: '8px 16px' }}>{t.signOut}</button></p>
      <p className="muted">{t.adminNote}</p>
      <h2>{t.liveNow}</h2>
      <p className="muted">{t.liveNowNote}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <span className="chip">🟢 {presence.users.length} {t.liveUsers}</span>
        <span className="chip">{presence.visitors} {t.visitorsBrowsing}</span>
      </div>
      <div className="grid">
        {presence.users.map((u) => (
          <section key={u.username} className="card">
            <div className="card-body">
              <p style={{ margin: 0 }}>🟢 <strong>{u.name || u.username}</strong> · @{u.username}{u.id ? ` · ${u.id}` : ''} · {u.secondsAgo}s</p>
            </div>
          </section>
        ))}
        {presence.users.length === 0 && <p className="muted">{t.noLiveUsers}</p>}
      </div>
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
      {channels && (
        <p className="muted" style={{ marginTop: 24 }}>🔔 {t.notifyChannels}: SMS {channels.sms ? `✓ ${t.channelOn}` : t.channelOff} · WhatsApp {channels.whatsapp ? `✓ ${t.channelOn}` : t.channelOff} · Email {channels.email ? `✓ ${t.channelOn}` : t.channelOff}</p>
      )}
      <h2 style={{ marginTop: 32 }}>💳 {t.paymentsTitle} ({payments.length})</h2>
      {paySummary && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <span className="chip">✓ {t.payConfirmedTotal}: <strong style={{ marginLeft: 4 }}>{paySummary.confirmedHTG.toLocaleString()} HTG</strong></span>
          <span className="chip">⏳ {t.payPendingTotal}: <strong style={{ marginLeft: 4 }}>{paySummary.pendingHTG.toLocaleString()} HTG</strong></span>
          <span className="chip">{t.payKindActivation}: {paySummary.byKind.activation.confirmedHTG.toLocaleString()} HTG</span>
          <span className="chip">{t.payKindAdvertising}: {paySummary.byKind.advertising.confirmedHTG.toLocaleString()} HTG</span>
        </div>
      )}
      <div className="grid" style={{ marginBottom: 16 }}>
        {payments.length === 0 && <p className="muted">{t.noPendingPayments}</p>}
        {payments.map((p) => (
          <section key={p.id} className="card">
            <div className="card-body" style={{ display: 'grid', gap: 6 }}>
              <p style={{ margin: 0 }}>
                <strong>{p.amountHTG.toLocaleString()} HTG</strong> · {p.provider === 'natcash' ? 'NatCash' : 'MonCash'} · <code style={{ fontSize: '1rem' }}>{p.reference}</code>
              </p>
              <p className="muted" style={{ margin: 0 }}>
                {p.kind === 'advertising' ? `${t.payKindAdvertising} · ${p.months} ${t.payMonthUnit} · ${p.listingTitle || p.listingId}` : t.payKindActivation}
              </p>
              <p className="muted" style={{ margin: 0 }}>
                {p.accountName} · @{p.username} · {t.transferFrom} {p.accountPhone} · {new Date(p.submittedAt).toLocaleString(params.locale === 'ht' ? 'fr' : params.locale)}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" type="button" onClick={() => reviewPayment(p, 'confirmed')} style={{ minHeight: 40, padding: '8px 16px' }}>✓ {t.payConfirmBtn}</button>
                <button className="btn btn-secondary" type="button" onClick={() => reviewPayment(p, 'rejected')} style={{ minHeight: 40, padding: '8px 16px' }}>{t.payRejectBtn}</button>
              </div>
            </div>
          </section>
        ))}
      </div>
      <h2 style={{ marginTop: 32 }}>⚑ {t.reportsTitle} ({reports.length})</h2>
      <div className="grid" style={{ marginBottom: 16 }}>
        {reports.length === 0 && <p className="muted">{t.noReports}</p>}
        {reports.map((r) => (
          <section key={r.id} className="card">
            <div className="card-body" style={{ display: 'grid', gap: 6 }}>
              <p style={{ margin: 0 }}>
                <strong>{r.kind === 'listing' ? t.reportListing : t.reportChat}</strong> · {t[{ scam: 'reasonScam', harassment: 'reasonHarassment', spam: 'reasonSpam', wrong_info: 'reasonWrongInfo', not_available: 'reasonNotAvailable', other: 'reasonOther' }[r.reason]] || r.reason}
              </p>
              <p className="muted" style={{ margin: 0 }}>
                @{r.reporter} · {new Date(r.createdAt).toLocaleString(params.locale === 'ht' ? 'fr' : params.locale)}
                {r.listingId && <> · <a href={`/${params.locale}/listings/${r.listingId}`}>{r.listingTitle || r.listingId}</a></>}
              </p>
              {r.details && <p style={{ margin: 0 }}>“{r.details}”</p>}
              {reportThreads[r.id] && (
                <div className="chat-box" style={{ padding: 10, border: '1px solid var(--line)', borderRadius: 12 }}>
                  <p className="muted" style={{ margin: 0 }}>@{reportThreads[r.id].conversation.tenant || '—'} ↔ @{reportThreads[r.id].conversation.landlord || '—'}{reportThreads[r.id].conversation.blockedBy ? ` · ⊘ @${reportThreads[r.id].conversation.blockedBy}` : ''}</p>
                  {reportThreads[r.id].messages.map((m) => (
                    <p key={m.id} className={`bubble ${m.sender === 'owner' ? 'bubble-theirs' : 'bubble-mine'}`} style={{ margin: 0 }}>
                      <strong>{m.sender === 'owner' ? t.ownerLabel : t.tenantLabel}:</strong> {m.text}
                    </p>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {r.kind === 'conversation' && (
                  <button className="btn btn-secondary" type="button" onClick={() => viewReportedThread(r)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.viewConversation}</button>
                )}
                {r.kind === 'listing' && (
                  <button className="btn btn-secondary" type="button" onClick={() => takeDown(r.listingId)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.takeDown}</button>
                )}
                <button className="btn" type="button" onClick={() => resolveReport(r.id)} style={{ minHeight: 40, padding: '8px 16px' }}>✓ {t.resolveReport}</button>
              </div>
            </div>
          </section>
        ))}
      </div>
      <details className="card" style={{ marginTop: 24 }}>
        <summary style={{ padding: '12px 16px', cursor: 'pointer', fontWeight: 800 }}>🧾 {t.auditTitle} ({auditEntries.length})</summary>
        <div className="card-body" style={{ display: 'grid', gap: 6, paddingTop: 4 }}>
          {auditEntries.length === 0 && <p className="muted" style={{ margin: 0 }}>—</p>}
          {auditEntries.slice(0, 100).map((e) => (
            <p key={e.id} style={{ margin: 0, fontSize: '0.88rem' }}>
              <span className="muted">{new Date(e.at).toLocaleString(params.locale === 'ht' ? 'fr' : params.locale)}</span>
              {' · '}<strong>{e.action}</strong>{e.target ? ` · ${e.target}` : ''}{' · '}<span className="muted">{e.actor}</span>
            </p>
          ))}
        </div>
      </details>
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
                {a.phone}{a.email ? ` · ${a.email}` : ''}{a.location ? ` · ${communeName(a.location.commune, params.locale)}, ${departmentName(a.location.department, params.locale)}` : ''}
              </p>
              <p className="muted" style={{ margin: '0 0 8px' }}>
                {a.activated ? `✓ ${t.accountActive}` : a.transferSent ? `⏳ ${t.transferFrom} ${a.phone} ${t.viaProvider} ${a.transferProvider === 'natcash' ? 'NatCash' : 'MonCash'}` : t.accountPending}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {a.role !== 'tenant' && !a.activated && (
                  <button className="btn" type="button" onClick={() => setActivated(a.username, true)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.activateAccount}</button>
                )}
                {a.role !== 'tenant' && a.activated && (
                  <button className="btn btn-secondary" type="button" onClick={() => setActivated(a.username, false)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.deactivateAccount}</button>
                )}
                <button className="btn btn-secondary" type="button" onClick={() => issueResetCode(a.username)} style={{ minHeight: 40, padding: '8px 16px' }}>🔑 {t.resetCodeButton}</button>
              </div>
              {resetCodes[a.username] && (
                <p style={{ margin: '8px 0 0' }}>{t.resetCodeIssued} <strong style={{ fontFamily: 'monospace', fontSize: 18 }}>{resetCodes[a.username]}</strong></p>
              )}
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
                <option key={c} value={c}>{communeName(c, params.locale)}</option>
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
                {communeName(l.commune, params.locale)} · {l.priceHTG.toLocaleString()} HTG
                {l.purpose === 'rent' ? ` ${rentPeriodLabel(l.rentPeriod, t)}` : ''}
                {l.advertised && <> · <span className="badge">📣 {t.advertised}</span></>}
                {l.advertisedRequested && !l.advertised && <> · <span className="badge">{t.advertisedRequestedBadge}</span></>}
                {l.verified && <> · <span className="badge-verified">✓ {t.verifiedListing}</span></>}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" type="button" onClick={() => setVerifiedListing(l.id, !l.verified)} style={{ minHeight: 40, padding: '8px 16px' }}>{l.verified ? t.unverifyListing : `✓ ${t.verifyListing}`}</button>
                {!l.advertised && (
                  <button className="btn" type="button" onClick={() => set(l.id, true)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.approveAdvertised}</button>
                )}
                {l.advertised && (
                  <button className="btn btn-secondary" type="button" onClick={() => set(l.id, false)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.removeAdvertised}</button>
                )}
                <button className="btn btn-secondary" type="button" onClick={() => takeDown(l.id)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.takeDown}</button>
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
