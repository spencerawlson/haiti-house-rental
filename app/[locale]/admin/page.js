'use client';

import { useCallback, useEffect, useState, use } from 'react';
import { getDict } from '@/lib/dictionaries';
import { rentPeriodLabel } from '@/lib/listings';
import { communeName } from '@/lib/departments';
import BackButton from '@/components/BackButton';
import AdminUsers from '@/components/AdminUsers';
import AdminTraffic from '@/components/AdminTraffic';
import Icon from '@/components/Icon';

// Admin: approve or remove advertising, track activation revenue, and
// convert it. Nothing here is automatic — a landlord's advertising
// checkbox is only a request until the admin approves, and revenue is
// logged only when the admin activates an account.
//
// The board is TABBED rather than one long scroll. Accounts moved behind
// their own tab (components/AdminUsers.jsx) because the list is a page of
// a table that may have a hundred thousand rows behind it: it has to be
// searched and paged on the server, and it must not be loading underneath
// the payment queue on every visit. Each panel fetches its own data when
// it is opened.
const TABS = ['overview', 'users'];

export default function Admin(props) {
  const params = use(props.params);
  const t = getDict(params.locale);
  const [tab, setTab] = useState('overview');
  const [listings, setListings] = useState([]);
  // Headline counts from the server. These used to be computed in the
  // browser by filtering the full account list, which only worked while
  // the whole list was being shipped to the browser.
  const [counts, setCounts] = useState(null);
  // Stable, because AdminTraffic's fetch depends on it: a fresh function
  // identity each render would restart that fetch in a loop.
  const onCounts = useCallback((c) => setCounts(c), []);
  const [reports, setReports] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paySummary, setPaySummary] = useState(null);
  // Which slice of the payment queue the board shows. Pending is the
  // default because that is the work queue — but a confirmed payment
  // must be reachable too, or its delete button can never appear.
  const [payStatus, setPayStatus] = useState('pending');
  // Receiver transaction ID typed per pending payment, and per-payment errors.
  const [txnInputs, setTxnInputs] = useState({});
  const [txnErrors, setTxnErrors] = useState({});
  // The permanent record of deleted transactions. Read-only: there is no
  // code path anywhere that removes an entry from it.
  const [deletions, setDeletions] = useState([]);
  const [auditEntries, setAuditEntries] = useState([]);
  const [channels, setChannels] = useState(null);
  const [reportThreads, setReportThreads] = useState({});
  const [revenue, setRevenue] = useState({ entries: [], byKind: {}, totalHTG: 0 });
  const [rates, setRates] = useState(null);
  const [rateError, setRateError] = useState(false);
  const [convertAmount, setConvertAmount] = useState('');
  const [moncashNumber, setMoncashNumber] = useState('');
  const [natcashNumber, setNatcashNumber] = useState('');
  const [adminUsers, setAdminUsers] = useState([]);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [adminUserMessage, setAdminUserMessage] = useState('');
  const [adViewsPer100, setAdViewsPer100] = useState(1000);
  const [adClicksPer100, setAdClicksPer100] = useState(200);
  const [adStats, setAdStats] = useState([]);
  const [numbersSaved, setNumbersSaved] = useState(false);
  const [presence, setPresence] = useState({ users: [], visitors: 0 });

  async function loadRates(fresh) {
    const res = await fetch(`/api/rates${fresh ? '?fresh=1' : ''}`);
    if (res.ok) {
      setRates(await res.json());
      setRateError(false);
    } else {
      setRateError(true);
    }
  }

  function revenueKindLabel(kind) {
    return {
      join: t.joinFeeLabel,
      quarter: t.revenueKindQuarter,
      reactivation: t.reactivationFeeLabel,
      advertising: t.payKindAdvertising,
      activation: t.payKindActivation,
      manual: t.revenueKindManual,
    }[kind] || kind;
  }

  async function loadPayments(status) {
    const payres = await fetch(`/api/admin/payments?status=${status === 'noTxn' ? 'confirmed' : status}`);
    if (payres.ok) {
      const data = await payres.json();
      setPayments(status === 'noTxn' ? (data.payments || []).filter((x) => !x.receiverTxn) : data.payments || []);
      setPaySummary(data.summary);
      setDeletions(data.deletions || []);
    }
  }

  async function load() {
    const res = await fetch('/api/listings');
    if (res.ok) {
      const data = await res.json();
      setListings(data.listings);
    }
    const rres = await fetch('/api/admin/revenue');
    if (rres.ok) {
      const data = await rres.json();
      setRevenue(data);
      if (!convertAmount) setConvertAmount(String(data.totalHTG));
    }
    await loadPayments(payStatus);
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
    const ares = await fetch('/api/admin/settings');
    if (ares.ok) {
      const data = await ares.json();
      setAdViewsPer100(data.adViewsPer100 ?? 1000);
      setAdClicksPer100(data.adClicksPer100 ?? 200);
    }
    const adres = await fetch('/api/admin/ad-stats');
    if (adres.ok) setAdStats((await adres.json()).stats || []);
    const aures = await fetch('/api/admin/admin-users');
    if (aures.ok) setAdminUsers((await aures.json()).users || []);
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
      body: JSON.stringify({ moncashNumber, natcashNumber, adViewsPer100, adClicksPer100 }),
    });
    setNumbersSaved(true);
  }

  // Named admin accounts (stats scope only). The full admin creates
  // them here; the partner signs in with username + password and sees
  // only the stats page — never this board.
  async function createAdminAccount(e) {
    e.preventDefault();
    setAdminUserMessage('');
    const res = await fetch('/api/admin/admin-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newAdminUsername.trim(), password: newAdminPassword }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setAdminUserMessage(data.error === 'exists' ? t.adminUserExists : data.error === 'password_too_short' ? t.adminPasswordTooShort : t.adminUserExists);
      return;
    }
    setAdminUserMessage(t.adminUserCreated);
    setNewAdminUsername('');
    setNewAdminPassword('');
    const rres = await fetch('/api/admin/admin-users');
    if (rres.ok) setAdminUsers((await rres.json()).users || []);
  }

  async function removeAdminAccount(username) {
    const res = await fetch('/api/admin/admin-users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    if (res.ok) {
      setAdminUserMessage(t.adminUserDeleted);
      setAdminUsers((prev) => prev.filter((u) => u.username !== username));
    }
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

  // Confirm only after finding the transfer on YOUR MonCash/NatCash
  // statement (sender phone + amount) and copying that line's transaction
  // ID — the receiver's ID, not the one the landlord sees. An ID already
  // used by a confirmed payment is refused, so one transfer can never pay
  // twice. Confirming without an ID is possible but must be chosen, and
  // the payment stays flagged.
  async function reviewPayment(p, decision) {
    let note = '';
    const receiverTxn = (txnInputs[p.id] || '').trim();
    let allowNoTxn = false;
    if (decision === 'confirmed') {
      if (!receiverTxn) {
        if (!window.confirm(`${t.payNoTxnConfirm}\n${p.senderPhone || p.reference} · ${p.amountHTG.toLocaleString()} HTG`)) return;
        allowNoTxn = true;
      } else if (!window.confirm(`${t.payConfirmPrompt}\n${p.senderPhone || p.reference} · ${p.amountHTG.toLocaleString()} HTG · ID ${receiverTxn}`)) {
        return;
      }
    }
    if (decision === 'rejected') {
      note = window.prompt(t.payRejectPrompt) ?? null;
      if (note === null) return;
    }
    const res = await fetch('/api/admin/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, decision, note, receiverTxn, allowNoTxn }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const u = data.usedBy;
      const msg = data.error === 'txn_used'
        ? `${t.payTxnUsed}${u ? ` @${u.username} · ${Number(u.amountHTG).toLocaleString()} HTG · ${new Date(u.confirmedAt).toLocaleDateString(params.locale === 'ht' ? 'fr' : params.locale)}` : ''}`
        : t.payError;
      setTxnErrors((prev) => ({ ...prev, [p.id]: msg }));
      return;
    }
    setTxnErrors((prev) => ({ ...prev, [p.id]: '' }));
    setTxnInputs((prev) => ({ ...prev, [p.id]: '' }));
    load();
  }

  // Delete a transaction (a test payment, a duplicate). The reason is
  // mandatory: an empty or cancelled prompt stops here, and the server
  // refuses a blank reason too — the deletion is recorded forever, so a
  // record with no stated reason would be the one thing it cannot fix.
  async function deleteTransaction(p) {
    if (!window.confirm(`${t.payDeleteConfirm}
${p.amountHTG.toLocaleString()} HTG · @${p.username}`)) return;
    const reason = window.prompt(t.payDeleteReasonPrompt);
    if (reason === null) return;
    if (!reason.trim()) {
      window.alert(t.payDeleteReasonRequired);
      return;
    }
    const res = await fetch('/api/admin/payments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, reason }),
    });
    if (!res.ok) {
      window.alert(t.payDeleteFailed);
      return;
    }
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

  async function adminLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = `/${params.locale}/admin-login`;
  }

  return (
    <main className="container admin">
      <BackButton locale={params.locale} />
      <header className="topbar" style={{ marginTop: 8 }}>
        <h1 className="page-title" style={{ margin: 0 }}><Icon name="shield" /> {t.adminTitle}</h1>
        <button className="btn btn-secondary" type="button" onClick={adminLogout} style={{ minHeight: 40, padding: '8px 16px' }}>{t.signOut}</button>
      </header>
      <p className="muted" style={{ marginTop: 0 }}>{t.adminNote}</p>

      {/* Tabs. Users is its own panel because the account list is paged
          from the server — it must not render underneath everything else. */}
      <div className="tabs" role="tablist" aria-label={t.adminTitle}>
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            className="tab"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {id === 'overview' ? <><Icon name="overview" /> {t.tabOverview}</> : <><Icon name="users" /> {t.accountsTitle}</>}
          </button>
        ))}
      </div>

      {tab === 'users' && <AdminUsers locale={params.locale} t={t} />}

      {tab === 'overview' && (
      <>
      {/* Summary tiles (same style as the landlord dashboard): what needs
          the admin now. Each tile jumps to its section. */}
      <div className="stat-tiles admin-tiles">
        <a href="#payments" className="stat-tile tone-amber"><span className="stat-icon"><Icon name="card" /></span><strong>{paySummary ? paySummary.pendingCount : '—'}</strong><span>{t.dashPendingPayments}{paySummary ? ` · ${paySummary.pendingHTG.toLocaleString()} HTG` : ''}</span></a>
        <a href="#reports" className="stat-tile tone-purple"><span className="stat-icon"><Icon name="flag" /></span><strong>{reports.length}</strong><span>{t.reportsTitle}</span></a>
        {/* Counted in Postgres, not by filtering a download of every
            account. Switches tabs rather than jumping to an anchor. */}
        <button type="button" className="stat-tile tone-blue" onClick={() => setTab('users')}><span className="stat-icon"><Icon name="hourglass" /></span><strong>{counts ? counts.pendingActivation : '—'}</strong><span>{t.pendingUsers}</span></button>
        <a href="#listings" className="stat-tile tone-green"><span className="stat-icon"><Icon name="home" /></span><strong>{listings.length}</strong><span>{t.statusLive}</span></a>
        <a href="#revenue" className="stat-tile tone-green"><span className="stat-icon"><Icon name="money" /></span><strong>{(paySummary?.confirmedHTG || 0).toLocaleString()}</strong><span>HTG · {t.payConfirmedTotal}</span></a>
        <a href="#live" className="stat-tile tone-blue"><span className="stat-icon"><Icon name="live" /></span><strong>{presence.users.length}</strong><span>{t.liveUsers}</span></a>
      </div>
      <nav className="chip-row admin-nav" aria-label={t.adminTitle}>
        {[['traffic', 'chart', t.trafficTitle], ['payments', 'card', t.paymentsTitle], ['reports', 'flag', t.reportsTitle], ['listings', 'home', t.advertisedTitle || t.adminTitle], ['revenue', 'money', t.revenueTitle], ['settings', 'settings', t.paymentNumbers], ['live', 'live', t.liveNow]].map(([id, icon, label]) => (
          <a key={id} className="chip" href={`#${id}`}><Icon name={icon} /> {label}</a>
        ))}
      </nav>
      <AdminTraffic locale={params.locale} t={t} onCounts={onCounts} />
      <h2 id="live" className="admin-h2"><Icon name="live" /> {t.liveNow}</h2>
      <p className="muted">{t.liveNowNote}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <span className="chip"><Icon name="live" /> {presence.users.length} {t.liveUsers}</span>
        <span className="chip">{presence.visitors} {t.visitorsBrowsing}</span>
      </div>
      <div className="grid">
        {presence.users.map((u) => (
          <section key={u.username} className="card">
            <div className="card-body">
              <p style={{ margin: 0 }}><Icon name="live" /> <strong>{u.name || u.username}</strong> · @{u.username}{u.id ? ` · ${u.id}` : ''} · {u.secondsAgo}s</p>
            </div>
          </section>
        ))}
        {presence.users.length === 0 && <p className="muted">{t.noLiveUsers}</p>}
      </div>
      <h2 id="settings" className="admin-h2"><Icon name="settings" /> {t.paymentNumbers}</h2>
      <form className="card" onSubmit={saveNumbers}>
        <div className="card-body" style={{ display: 'grid', gap: 14 }}>
          <div className="field"><label>{t.moncashNumber}</label>
            <input className="input" type="tel" value={moncashNumber} onChange={(e) => setMoncashNumber(e.target.value)} placeholder="+509 ____ ____" />
          </div>
          <div className="field"><label>{t.natcashNumber}</label>
            <input className="input" type="tel" value={natcashNumber} onChange={(e) => setNatcashNumber(e.target.value)} placeholder="+509 ____ ____" />
          </div>
          <div className="field"><label>{t.adViewsPer100}</label>
            <input className="input" type="number" min={0} step={1} value={adViewsPer100} onChange={(e) => setAdViewsPer100(Number(e.target.value))} />
          </div>
          <div className="field"><label>{t.adClicksPer100}</label>
            <input className="input" type="number" min={0} step={1} value={adClicksPer100} onChange={(e) => setAdClicksPer100(Number(e.target.value))} />
          </div>
          <button className="btn" type="submit" style={{ minHeight: 40, padding: '8px 16px' }}>{t.saveNumbers}</button>
          {numbersSaved && <p style={{ margin: 0 }}>{t.numbersSaved}</p>}
        </div>
      </form>
      <h2 id="admin-users" className="admin-h2"><Icon name="users" /> {t.adminUsersTitle}</h2>
      <p className="muted">{t.adminUsersNote}</p>
      <form className="card" onSubmit={createAdminAccount}>
        <div className="card-body" style={{ display: 'grid', gap: 14 }}>
          <div className="field"><label>{t.username}</label>
            <input className="input" value={newAdminUsername} onChange={(e) => setNewAdminUsername(e.target.value)} required />
          </div>
          <div className="field"><label>{t.password}</label>
            <input className="input" type="password" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} required />
          </div>
          <button className="btn" type="submit" style={{ minHeight: 40, padding: '8px 16px' }}>{t.adminUserCreate}</button>
          {adminUserMessage && <p style={{ margin: 0 }}>{adminUserMessage}</p>}
        </div>
      </form>
      <div className="grid" style={{ marginTop: 12 }}>
        {adminUsers.map((u) => (
          <section key={u.username} className="card">
            <div className="card-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ margin: 0 }}><strong>{u.username}</strong> · {u.scope}</p>
              <button className="btn btn-danger" type="button" onClick={() => removeAdminAccount(u.username)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.adminUserDelete}</button>
            </div>
          </section>
        ))}
      </div>
      {channels && (
        <p className="muted" style={{ marginTop: 24 }}><Icon name="bell" /> {t.notifyChannels}: SMS {channels.sms ? `✓ ${t.channelOn}` : t.channelOff} · WhatsApp {channels.whatsapp ? `✓ ${t.channelOn}` : t.channelOff} · Email {channels.email ? `✓ ${t.channelOn}` : t.channelOff}</p>
      )}
      <h2 id="payments" className="admin-h2"><Icon name="card" /> {t.paymentsTitle} ({payments.length})</h2>
      {paySummary && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <span className="chip">✓ {t.payConfirmedTotal}: <strong style={{ marginLeft: 4 }}>{paySummary.confirmedHTG.toLocaleString()} HTG</strong></span>
          <span className="chip"><Icon name="hourglass" /> {t.payPendingTotal}: <strong style={{ marginLeft: 4 }}>{paySummary.pendingHTG.toLocaleString()} HTG</strong></span>
          <span className="chip">{t.payKindActivation}: {paySummary.byKind.activation.confirmedHTG.toLocaleString()} HTG</span>
          <span className="chip">{t.payKindAdvertising}: {paySummary.byKind.advertising.confirmedHTG.toLocaleString()} HTG</span>
        </div>
      )}
      {/* The queue filter. Pending is the work queue, but confirmed and
          rejected payments must be reachable — a confirmed test payment
          can only be deleted from a list that shows it. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <select className="input" style={{ maxWidth: 220 }} value={payStatus} onChange={(e) => { const s = e.target.value; setPayStatus(s); loadPayments(s); }} aria-label={t.paymentsTitle}>
          <option value="pending">{t.payPending}</option>
          <option value="confirmed">{t.payConfirmed}</option>
          <option value="noTxn">{t.payNoTxnFilter}</option>
          <option value="rejected">{t.payRejected}</option>
          <option value="all">{t.all}</option>
        </select>
      </div>
      <div className="grid" style={{ marginBottom: 16 }}>
        {payments.length === 0 && <p className="muted">{payStatus === 'pending' ? t.noPendingPayments : '—'}</p>}
        {payments.map((p) => (
          <section key={p.id} className="card">
            <div className="card-body" style={{ display: 'grid', gap: 6 }}>
              <p style={{ margin: 0 }}>
                {/* The phone the transfer was sent from — what you match
                    against the MonCash/NatCash statement. */}
                <strong>{p.amountHTG.toLocaleString()} HTG</strong> · {p.provider === 'natcash' ? 'NatCash' : 'MonCash'} · <code style={{ fontSize: '1rem' }}>{p.senderPhone || p.reference}</code>
              </p>
              <p className="muted" style={{ margin: 0 }}>
                {p.kind === 'advertising' ? (p.months ? `${t.payKindAdvertising} · ${p.months} ${t.payMonthUnit} · ${p.listingTitle || p.listingId}` : `${t.payKindAdvertising} · ${p.listingTitle || p.listingId}`) : t.payKindActivation}
              </p>
              {p.status === 'confirmed' && (
                <p style={{ margin: 0 }}>
                  {p.receiverTxn
                    ? <span className="muted">{t.payTxnLabel}: <code>{p.receiverTxn}</code></span>
                    : <span className="badge"><Icon name="warning" /> {t.payNoTxnBadge}</span>}
                </p>
              )}
              <p className="muted" style={{ margin: 0 }}>
                {p.accountName} · @{p.username} · {t.transferFrom} {p.accountPhone} · {new Date(p.submittedAt).toLocaleString(params.locale === 'ht' ? 'fr' : params.locale)}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {/* Confirm/Reject only make sense on a pending payment —
                    confirming an already-confirmed row would just 409. */}
                {p.status === 'pending' && (
                  <>
                    <input
                      className="input"
                      style={{ flex: '1 1 100%' }}
                      value={txnInputs[p.id] || ''}
                      onChange={(e) => setTxnInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder={t.payTxnPlaceholder}
                      aria-label={t.payTxnPlaceholder}
                      autoCapitalize="characters"
                    />
                    {txnErrors[p.id] && <p style={{ flex: '1 1 100%', margin: 0, color: '#dc2626', fontWeight: 700 }}>{txnErrors[p.id]}</p>}
                    <button className="btn" type="button" onClick={() => reviewPayment(p, 'confirmed')} style={{ minHeight: 40, padding: '8px 16px' }}>✓ {t.payConfirmBtn}</button>
                    <button className="btn btn-secondary" type="button" onClick={() => reviewPayment(p, 'rejected')} style={{ minHeight: 40, padding: '8px 16px' }}>{t.payRejectBtn}</button>
                  </>
                )}
                <button className="btn btn-danger" type="button" onClick={() => deleteTransaction(p)} style={{ minHeight: 40, padding: '8px 16px' }}><Icon name="trash" /> {t.payDeleteBtn}</button>
              </div>
            </div>
          </section>
        ))}
      </div>
      {/* Deleted transactions. Kept forever and on purpose: a deletion
          that leaves no trace is worse than the test payment it removed.
          Nothing on this screen — or anywhere in the app — can clear an
          entry from this list. */}
      <details className="card" style={{ marginBottom: 16 }}>
        <summary style={{ padding: '12px 16px', cursor: 'pointer', fontWeight: 800 }}><Icon name="trash" /> {t.payDeletedTitle} ({deletions.length})</summary>
        <div className="card-body" style={{ display: 'grid', gap: 8, paddingTop: 4 }}>
          <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>{t.payDeletedNote}</p>
          {deletions.length === 0 && <p className="muted" style={{ margin: 0 }}>—</p>}
          {deletions.map((d) => (
            <div key={d.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                <strong>{d.amountHTG.toLocaleString()} HTG</strong> · {d.provider === 'natcash' ? 'NatCash' : 'MonCash'}
                {d.senderPhone ? ` · ${d.senderPhone}` : ''} · @{d.username}
                {' · '}<span className="muted">{{ confirmed: t.payConfirmed, rejected: t.payRejected, pending: t.payPending }[d.status] || d.status}</span>
              </p>
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                {new Date(d.deletedAt).toLocaleString(params.locale === 'ht' ? 'fr' : params.locale)} · {d.deletedBy}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '0.9rem' }}><Icon name="chat" /> {d.reason}</p>
            </div>
          ))}
        </div>
      </details>
      <h2 id="reports" className="admin-h2"><Icon name="flag" /> {t.reportsTitle} ({reports.length})</h2>
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
                  <p className="muted" style={{ margin: 0 }}>@{reportThreads[r.id].conversation.tenant || '—'} <Icon name="swap" /> @{reportThreads[r.id].conversation.landlord || '—'}{reportThreads[r.id].conversation.blockedBy ? ` · ⊘ @${reportThreads[r.id].conversation.blockedBy}` : ''}</p>
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
        <summary style={{ padding: '12px 16px', cursor: 'pointer', fontWeight: 800 }}><Icon name="receipt" /> {t.auditTitle} ({auditEntries.length})</summary>
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
      <h2 id="revenue" className="admin-h2"><Icon name="money" /> {t.revenueTitle}</h2>
      <div className="card">
        <div className="card-body">
          <p style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 4px' }}>{revenue.totalHTG.toLocaleString()} HTG</p>
          <p className="muted" style={{ margin: '0 0 4px' }}>{t.revenueNote}</p>
          <p className="muted" style={{ margin: 0 }}>{t.revenueStartNote}</p>
        </div>
      </div>
      {/* Every confirmed payment at its real amount, by kind. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
        {Object.entries(revenue.byKind || {}).map(([kind, htg]) => (
          <span key={kind} className="chip">{revenueKindLabel(kind)}: <strong style={{ marginLeft: 4 }}>{htg.toLocaleString()} HTG</strong></span>
        ))}
      </div>
      <h3 style={{ marginTop: 16 }}>{t.revenuePaymentsTitle}</h3>
      <div className="grid">
        {revenue.entries.map((e) => (
          <section key={e.key} className="card">
            <div className="card-body">
              <p style={{ margin: '0 0 4px' }}><strong>{e.amountHTG.toLocaleString()} HTG</strong> · {revenueKindLabel(e.kind)}</p>
              <p className="muted" style={{ margin: 0 }}>
                {e.name} · @{e.username} · {new Date(e.at).toLocaleDateString(params.locale === 'ht' ? 'fr' : params.locale)}
              </p>
            </div>
          </section>
        ))}
        {revenue.entries.length === 0 && <p className="muted">{t.noActivations}</p>}
      </div>
      <h2 className="admin-h2"><Icon name="exchange" /> {t.converterTitle}</h2>
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
      <h2 id="listings" className="admin-h2"><Icon name="home" /> {t.advertisedTitle || t.adminTitle}</h2>
      <div className="grid">
        {listings.map((l) => (
          <section key={l.id} className="card">
            <div className="card-body">
              <h3 style={{ margin: '0 0 4px' }}>{l.title}</h3>
              <p className="muted" style={{ margin: '0 0 8px' }}>
                {communeName(l.commune, params.locale)} · {l.price.toLocaleString()} {l.currency || 'HTG'}
                {l.purpose === 'rent' ? ` ${rentPeriodLabel(l.rentPeriod, t)}` : ''}
                {l.advertised && <> · <span className="badge"><Icon name="megaphone" /> {t.advertised}</span></>}
                {l.advertisedRequested && !l.advertised && <> · <span className="badge">{t.advertisedRequestedBadge}</span></>}
                {l.verified && <> · <span className="badge-verified">✓ {t.verifiedListing}</span></>}
              </p>
              {(() => {
                const s = adStats.find((a) => a.id === l.id);
                if (!s || s.amountHTG == null) return null;
                return (
                  <p className="muted" style={{ margin: '0 0 8px' }}>
                    {s.amountHTG.toLocaleString()} HTG · {t.adViews} {s.viewsUsed.toLocaleString()}/{s.viewsBudget.toLocaleString()} · {t.adClicks} {s.clicksUsed.toLocaleString()}/{s.clicksBudget.toLocaleString()}
                    {s.paused && <> · <strong>{t.adPausedNote}</strong></>}
                  </p>
                );
              })()}
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
      </>
      )}
    </main>
  );
}
