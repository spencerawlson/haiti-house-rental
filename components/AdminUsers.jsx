'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEPARTMENTS, departmentName, communeName } from '@/lib/departments';
import { hashPassword } from '@/lib/account';
import Icon from '@/components/Icon';

// The Admin Board's Users tab.
//
// This used to be a section of the board that rendered one card per
// account, from a response containing every account in the database. That
// is fine at fifty accounts and hopeless at fifty thousand: the query
// aggregated every login event ever recorded, the JSON carried every
// phone number on the site, and the browser built a DOM node for all of
// it — on every visit to the board, whether or not anyone scrolled down.
//
// Now the server does the work: one page at a time, searched and filtered
// in Postgres (lib/accounts-server.js), with the engagement figures
// computed for the usernames on screen and nothing else. The panel fetches
// only when it is actually open, which is what makes it a tab rather than
// a section.
//
// Engagement figures: "—" means NOT RECORDED rather than zero. Login
// history starts at the deploy that added it (0008), so an older account
// genuinely has nothing to show.
function sinceLabel(ms, t) {
  if (!ms) return '—';
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 1) return t.justNow;
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} j`;
}

function durationLabel(ms) {
  if (ms === null || ms === undefined) return '—';
  const mins = Math.round(ms / 60000);
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

export default function AdminUsers({ locale, t }) {
  const dateLocale = locale === 'ht' ? 'fr' : locale;
  const [page, setPage] = useState(1);
  const [per, setPer] = useState(25);
  const [role, setRole] = useState('');
  const [billing, setBilling] = useState('');
  // Two states for the search box: what is typed, and what has been sent.
  // Firing a query per keystroke would put a full-text search on every
  // letter of someone's name.
  const [typed, setTyped] = useState('');
  const [term, setTerm] = useState('');
  const [data, setData] = useState({ accounts: [], total: 0, pages: 1, page: 1 });
  const [loading, setLoading] = useState(true);
  const [resetCodes, setResetCodes] = useState({});
  // Typed listing limits per account, and the last save message.
  const [limits, setLimits] = useState({});
  const [limitMsg, setLimitMsg] = useState({});

  useEffect(() => {
    const id = setTimeout(() => {
      setTerm(typed.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [typed]);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), per: String(per) });
    if (term) qs.set('q', term);
    if (role) qs.set('role', role);
    if (billing) qs.set('billing', billing);
    try {
      const res = await fetch(`/api/accounts?${qs}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [page, per, term, role, billing]);

  useEffect(() => {
    load();
  }, [load]);

  async function setActivated(username, activated) {
    await fetch('/api/admin/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, activated }),
    });
    load();
  }

  // Admin-assisted recovery: confirm who is asking (call back the phone
  // on the account) before reading the code to them.
  // Set or clear how many homes an account may have live at once (0015).
  // Empty = no limit. Lowering it removes nothing already posted.
  async function saveLimit(a, clear = false) {
    const value = clear ? null : (limits[a.username] ?? a.listingLimit ?? '');
    const res = await fetch('/api/admin/listing-limit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: a.username, limit: value === '' ? null : value }),
    });
    const data = await res.json().catch(() => ({}));
    setLimitMsg((prev) => ({ ...prev, [a.username]: res.ok ? `✓ ${t.listingLimitSaved}` : t.listingLimitInvalid }));
    if (res.ok) {
      setLimits((prev) => ({ ...prev, [a.username]: undefined }));
      load();
    }
  }

  async function issueResetCode(username) {
    if (!window.confirm(t.resetCodeConfirm)) return;
    const res = await fetch('/api/admin/reset-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    if (res.ok) {
      const d = await res.json();
      setResetCodes((prev) => ({ ...prev, [username]: d.code }));
    }
  }

  const { accounts, total, pages } = data;
  const first = total === 0 ? 0 : (data.page - 1) * per + 1;
  const last = Math.min(data.page * per, total);

  return (
    <>
      <h2 className="admin-h2"><Icon name="users" /> {t.accountsTitle}</h2>
      <p className="muted">{t.accountsNote}</p>
      <p className="muted" style={{ marginTop: -6 }}>{t.metricsNote}</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'grid', gap: 12 }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="user-search">{t.searchUsers}</label>
            <input
              id="user-search"
              className="input"
              type="search"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={t.searchUsersPlaceholder}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select className="input" style={{ maxWidth: 190 }} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label={t.filterRole}>
              <option value="">{t.filterRoleAll}</option>
              <option value="tenant">{t.roleTenant}</option>
              <option value="landlord">{t.roleLandlord}</option>
            </select>
            <select className="input" style={{ maxWidth: 220 }} value={billing} onChange={(e) => { setBilling(e.target.value); setPage(1); }} aria-label={t.filterBilling}>
              <option value="">{t.filterBillingAll}</option>
              <option value="pending">{t.billingPending}</option>
              <option value="active">{t.billingActive}</option>
              <option value="suspended">{t.billingSuspended}</option>
              <option value="deactivated">{t.billingDeactivated}</option>
            </select>
            <select className="input" style={{ maxWidth: 140 }} value={per} onChange={(e) => { setPer(Number(e.target.value)); setPage(1); }} aria-label={t.perPage}>
              {[25, 50, 100].map((n) => <option key={n} value={n}>{n} / {t.pageWord}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <span className="chip">{t.totalUsers}: {total.toLocaleString()}</span>
        {total > 0 && <span className="muted">{t.showingRange.replace('{first}', first).replace('{last}', last).replace('{total}', total.toLocaleString())}</span>}
      </div>

      <div className="grid">
        {accounts.map((a) => (
          <section key={a.username} className="card">
            <div className="card-body">
              <h3 style={{ margin: '0 0 4px' }}>{a.id ? `${a.id} · ` : ''}{a.name} · @{a.username} · {a.role === 'tenant' ? t.roleTenant : t.roleLandlord}{a.partner ? <> · <Icon name="partner" /> {t.partner}</> : ''}</h3>
              <p className="muted" style={{ margin: '0 0 4px' }}>
                {a.phone}{a.email ? ` · ${a.email}` : ''}{a.location ? ` · ${communeName(a.location.commune, locale)}, ${departmentName(a.location.department, locale)}` : ''}
              </p>
              <p className="muted" style={{ margin: '0 0 8px' }}>
                {a.activated ? `✓ ${t.accountActive}` : a.transferSent ? <><Icon name="hourglass" /> {t.transferFrom} {a.phone} {t.viaProvider} {a.transferProvider === 'natcash' ? 'NatCash' : 'MonCash'}</> : t.accountPending}
                {a.role === 'landlord' && !a.partner && (
                  <>
                    {' · '}
                    {{ pending: t.billingPending, active: t.billingActive, suspended: t.billingSuspended, deactivated: t.billingDeactivated }[a.billingStatus || 'pending']}
                    {a.paidUntil ? ` · ${t.paidUntilLabel} ${new Date(a.paidUntil).toLocaleDateString(dateLocale)}` : ''}
                  </>
                )}
              </p>
              <div className="metric-row">
                <span title={t.lastSeenHelp}>
                  <Icon name="eye" /> {t.lastSeen}: <strong>{sinceLabel(a.metrics?.lastSeenAt, t)}</strong>
                  {a.metrics?.activeSessions > 0 && <span className="live-dot" title={t.liveNow} />}
                </span>
                <span title={t.loginsHelp}><Icon name="key" /> {t.logins}: <strong>{a.metrics?.logins ?? 0}</strong></span>
                <span title={t.avgSessionHelp}><Icon name="timer" /> {t.avgSession}: <strong>{durationLabel(a.metrics?.avgSessionMs)}</strong></span>
                <span title={t.visitsCountHelp}>
                  <Icon name="calendar" /> {t.visitsCount}: <strong>{a.metrics?.visits ?? 0}</strong>
                  {' '}<span className="muted">({a.metrics?.visitsActive ?? 0} {t.visitsLive})</span>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {a.role !== 'tenant' && !a.activated && (
                  <button className="btn" type="button" onClick={() => setActivated(a.username, true)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.activateAccount}</button>
                )}
                {a.role !== 'tenant' && a.activated && (
                  <button className="btn btn-secondary" type="button" onClick={() => setActivated(a.username, false)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.deactivateAccount}</button>
                )}
                <button className="btn btn-secondary" type="button" onClick={() => issueResetCode(a.username)} style={{ minHeight: 40, padding: '8px 16px' }}><Icon name="key" /> {t.resetCodeButton}</button>
              </div>
              {a.role !== 'tenant' && (
                <div className="limit-row">
                  <span><Icon name="home" /> {t.listingLimitLabel}: <strong>{a.liveListings ?? 0}{a.listingLimit !== null && a.listingLimit !== undefined ? ` / ${a.listingLimit}` : ''}</strong>{a.listingLimit === null || a.listingLimit === undefined ? <span className="muted"> · {t.listingLimitNone}</span> : ''}</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={limits[a.username] ?? (a.listingLimit ?? '')}
                    onChange={(e) => setLimits((prev) => ({ ...prev, [a.username]: e.target.value }))}
                    placeholder={t.listingLimitNone}
                    aria-label={t.listingLimitLabel}
                    style={{ width: 110 }}
                  />
                  <button className="btn btn-secondary" type="button" onClick={() => saveLimit(a)} style={{ minHeight: 40, padding: '8px 14px' }}>{t.listingLimitSave}</button>
                  {a.listingLimit !== null && a.listingLimit !== undefined && (
                    <button className="btn btn-secondary" type="button" onClick={() => saveLimit(a, true)} style={{ minHeight: 40, padding: '8px 14px' }}>{t.listingLimitClear}</button>
                  )}
                  {limitMsg[a.username] && <span className="muted">{limitMsg[a.username]}</span>}
                </div>
              )}
              {resetCodes[a.username] && (
                <p style={{ margin: '8px 0 0' }}>{t.resetCodeIssued} <strong style={{ fontFamily: 'monospace', fontSize: 18 }}>{resetCodes[a.username]}</strong></p>
              )}
            </div>
          </section>
        ))}
        {!loading && accounts.length === 0 && <p className="muted">{t.noAccounts}</p>}
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" type="button" disabled={data.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ minHeight: 40, padding: '8px 16px' }}>‹ {t.prevPage}</button>
          <span className="muted">{t.pageOf.replace('{page}', data.page).replace('{pages}', pages)}</span>
          <button className="btn btn-secondary" type="button" disabled={data.page >= pages} onClick={() => setPage((p) => p + 1)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.nextPage} ›</button>
        </div>
      )}

      <PartnerForm locale={locale} t={t} onCreated={load} />
    </>
  );
}

function PartnerForm({ locale, t, onCreated }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('ouest');
  const [commune, setCommune] = useState('');
  const [message, setMessage] = useState('');

  async function createPartner(e) {
    e.preventDefault();
    setMessage('');
    const res = await fetch('/api/admin/partner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim() || username.trim(),
        username: username.trim(),
        passwordHash: await hashPassword(password),
        phone: phone.trim(),
        email: email.trim(),
        location: { department, commune },
      }),
    });
    if (!res.ok) {
      setMessage(t.partnerExists);
      return;
    }
    setMessage(t.partnerCreated);
    setName('');
    setUsername('');
    setPassword('');
    setPhone('');
    setEmail('');
    setCommune('');
    onCreated();
  }

  return (
    <>
      <h2 className="admin-h2"><Icon name="partner" /> {t.createPartnerAccount}</h2>
      <p className="muted">{t.partnerNote}</p>
      <form className="card" onSubmit={createPartner}>
        <div className="card-body" style={{ display: 'grid', gap: 14 }}>
          <div className="field"><label>{t.fullName}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.username} />
          </div>
          <div className="field"><label>{t.username}</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="field"><label>{t.password}</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="field"><label>{t.phoneLabel}</label>
            <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+509 ____ ____" />
          </div>
          <div className="field"><label>{t.email}</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field"><label>{t.department}</label>
            <select className="input" value={department} onChange={(e) => { setDepartment(e.target.value); setCommune(''); }}>
              {DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.id}>{departmentName(d.id, locale)}</option>
              ))}
            </select>
          </div>
          <div className="field"><label>{t.commune}</label>
            <select className="input" value={commune} onChange={(e) => setCommune(e.target.value)} required>
              <option value=""></option>
              {(DEPARTMENTS.find((d) => d.id === department)?.communes || []).map((c) => (
                <option key={c} value={c}>{communeName(c, locale)}</option>
              ))}
            </select>
          </div>
          <button className="btn" type="submit" style={{ minHeight: 40, padding: '8px 16px' }}>{t.createPartnerAccount}</button>
          {message && <p style={{ margin: 0 }}>{message}</p>}
        </div>
      </form>
    </>
  );
}
