'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getDict } from '@/lib/dictionaries';
import { LOCALES, ACTIVATION_FEE_HTG } from '@/lib/config';
import { departmentName, communeName } from '@/lib/departments';
import { getMyAccount, signOut } from '@/lib/account';
import PaymentForm from '@/components/PaymentForm';
import TabBar from '@/components/TabBar';
import ThemeToggle from '@/components/ThemeToggle';

// Account (design: docs/design/app-showcase.png — screen 12 profile menu,
// and for landlords the screen 11 dashboard tiles). Details live on their
// own pages (chats, visits, favorites, library, payments); this page is
// the hub. Signed out, it offers sign-in / account creation.
function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
}

function MenuRow({ href, icon, label, badge, onClick }) {
  const inner = (
    <>
      <span className="menu-icon" aria-hidden="true">{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge > 0 && <span className="count-badge">{badge}</span>}
      <span className="muted" aria-hidden="true">›</span>
    </>
  );
  return onClick ? (
    <button type="button" className="menu-row" onClick={onClick}>{inner}</button>
  ) : (
    <Link href={href} className="menu-row">{inner}</Link>
  );
}

export default function Account({ params }) {
  const t = getDict(params.locale);
  const base = `/${params.locale}`;
  const [me, setMe] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [payments, setPayments] = useState([]);
  const [destination, setDestination] = useState({ moncashNumber: '', natcashNumber: '' });
  const [visits, setVisits] = useState([]);
  const [threads, setThreads] = useState([]);
  const [myHomes, setMyHomes] = useState([]);

  useEffect(() => {
    getMyAccount().then((a) => {
      setMe(a);
      setLoaded(true);
      if (!a) return;
      fetch('/api/visits').then((r) => r.json()).then((d) => setVisits(d.visits || [])).catch(() => {});
      fetch('/api/chat/inbox').then((r) => r.json()).then((d) => setThreads(d.threads || [])).catch(() => {});
      if (a.role !== 'tenant') {
        fetch('/api/payments').then((r) => r.json()).then((d) => setPayments(d.payments || [])).catch(() => {});
        fetch(`/api/listings?owner=${encodeURIComponent(a.username)}`).then((r) => r.json()).then((d) => setMyHomes(d.listings || [])).catch(() => {});
      }
    });
    fetch('/api/settings').then((r) => r.json()).then(setDestination).catch(() => {});
  }, []);

  async function logout() {
    await signOut();
    setMe(null);
  }

  const isLandlord = !!me && me.role !== 'tenant';
  const unread = threads.reduce((sum, th) => sum + th.unread, 0);
  const upcomingVisits = visits.filter((v) => ['proposed', 'confirmed'].includes(v.status)).length;
  const pendingPayments = payments.filter((p) => p.status === 'pending').length;
  const activationPending = payments.some((p) => p.kind === 'activation' && p.status === 'pending');

  return (
    <>
      <main className="container">
        <h1 className="page-title">{t.myProfile}</h1>

        {loaded && !me && (
          <section className="card" style={{ marginBottom: 20 }}>
            <div className="card-body" style={{ display: 'grid', gap: 12 }}>
              <p style={{ margin: 0 }}>{t.signInToPost}</p>
              <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: 0 }}>
                <Link className="btn" href={`${base}/signin`}>{t.signIn}</Link>
                <Link className="btn btn-secondary" href={`${base}/signup`}>{t.createAccount}</Link>
              </p>
            </div>
          </section>
        )}

        {loaded && me && (
          <section className="profile-head">
            <span className="avatar" aria-hidden="true">{initials(me.name)}</span>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0 }}>{me.name}</h2>
              <p style={{ margin: '2px 0 0', color: 'var(--primary)', fontWeight: 700 }}>{me.role === 'tenant' ? t.roleTenant : t.roleLandlord}</p>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.88rem' }}>
                @{me.username}{me.id ? ` · ${me.id}` : ''}
              </p>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.88rem' }}>
                {me.phone}{me.email ? ` · ${me.email}` : ''}
                {me.location ? ` · 📍 ${communeName(me.location.commune, params.locale)}, ${departmentName(me.location.department, params.locale)}` : ''}
              </p>
            </div>
          </section>
        )}

        {isLandlord && !me.activated && (
          <section className="card" style={{ marginBottom: 20 }}>
            <div className="card-body" style={{ display: 'grid', gap: 10 }}>
              <p style={{ margin: 0 }}><strong>{t.accountPending}</strong> {t.sendTransfer}</p>
              {activationPending ? (
                <p style={{ margin: 0 }}>⏳ {t.waitingActivation}</p>
              ) : (
                <PaymentForm kind="activation" amountHTG={ACTIVATION_FEE_HTG} destination={destination} strings={t} onSubmitted={(p) => setPayments((prev) => [p, ...prev])} />
              )}
            </div>
          </section>
        )}

        {isLandlord && (
          <>
            <h2 style={{ margin: '8px 0 12px' }}>{t.landlordDashboard}</h2>
            <div className="stat-tiles">
              <Link href={`${base}/library`} className="stat-tile tone-blue"><span className="stat-icon">🏠</span><strong>{myHomes.length}</strong><span>{t.myListings}</span></Link>
              <Link href={`${base}/chats`} className="stat-tile tone-green"><span className="stat-icon">💬</span><strong>{unread}</strong><span>{t.dashNewMessages}</span></Link>
              <Link href={`${base}/visits`} className="stat-tile tone-purple"><span className="stat-icon">📅</span><strong>{upcomingVisits}</strong><span>{t.dashVisits}</span></Link>
              <Link href={`${base}/payments`} className="stat-tile tone-amber"><span className="stat-icon">💳</span><strong>{pendingPayments}</strong><span>{t.dashPendingPayments}</span></Link>
            </div>
            {me.activated && (
              <p style={{ margin: '14px 0 0' }}><Link className="btn" href={`${base}/list`} style={{ width: '100%' }}>＋ {t.addNewHome}</Link></p>
            )}
          </>
        )}

        <nav className="menu card" style={{ marginTop: 20 }}>
          {me && <MenuRow href={`${base}/chats`} icon="💬" label={t.myMessages} badge={unread} />}
          {me && <MenuRow href={`${base}/visits`} icon="📅" label={t.myVisits} badge={0} />}
          <MenuRow href={`${base}/favorites`} icon="♡" label={t.favorites} />
          <MenuRow href={`${base}/saved-searches`} icon="🔔" label={t.savedSearches} />
          <MenuRow href={`${base}/near-me`} icon="📍" label={t.nearMe} />
          {isLandlord && <MenuRow href={`${base}/library`} icon="🏠" label={t.library} />}
          {isLandlord && <MenuRow href={`${base}/payments`} icon="💳" label={t.myPayments} badge={0} />}
          {loaded && !me && <MenuRow href={`${base}/list`} icon="＋" label={t.postHome} />}
        </nav>

        <section className="card" style={{ marginTop: 20 }}>
          <div className="card-body">
            <p style={{ margin: '0 0 8px', fontWeight: 700 }}>🌐 {t.language}</p>
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
            <p style={{ margin: '16px 0 8px', fontWeight: 700 }}>🌓 {t.theme}</p>
            <ThemeToggle lightLabel={t.themeLight} darkLabel={t.themeDark} />
          </div>
        </section>

        {me && (
          <nav className="menu card" style={{ marginTop: 20 }}>
            <MenuRow icon="↪" label={t.signOut} onClick={logout} />
          </nav>
        )}
      </main>
      <TabBar locale={params.locale} t={t} />
    </>
  );
}
