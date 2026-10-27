'use client';

import Link from 'next/link';
import { useEffect, useState, use } from 'react';
import { getDict } from '@/lib/dictionaries';
import { getSession, getMyAccount } from '@/lib/account';
import TabBar from '@/components/TabBar';
import PaymentForm from '@/components/PaymentForm';
import Icon from '@/components/Icon';
import { photoSrc } from '@/lib/photo-url';

// How long a sold/leased home has before it is deleted. Hours while
// there is more than one left, otherwise minutes, so the last stretch
// does not just read "0 h".
function hoursLeft(deletesAt) {
  const ms = deletesAt - Date.now();
  if (ms <= 0) return '0 min';
  const hours = Math.floor(ms / 3600000);
  return hours >= 1 ? `${hours} h` : `${Math.max(1, Math.round(ms / 60000))} min`;
}

// A landlord's library: every home they ever posted, live and taken
// down, newest first. Live homes can be viewed, edited or taken down;
// taken-down homes can be put back online. Tenants see an empty library
// (they post nothing); signed-out visitors are pointed to sign-in.
export default function Library(props) {
  const params = use(props.params);
  const t = getDict(params.locale);
  const [me, setMe] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [homes, setHomes] = useState([]);
  const [adOpen, setAdOpen] = useState(null);
  const [pendingAds, setPendingAds] = useState({});
  const [destination, setDestination] = useState({ moncashNumber: '', natcashNumber: '' });
  const [error, setError] = useState('');
  // { limit, used } from /api/accounts/me — limit null = no limit.
  const [usage, setUsage] = useState(null);

  function load(username) {
    refreshUsage(); // a take-down, sale or restore changes the count
    fetch(`/api/listings?owner=${encodeURIComponent(username)}&all=1`)
      .then((r) => r.json())
      .then((d) => setHomes(d.listings || []))
      .catch(() => {});
  }

  // Pause/resume for one campaign. Pausing hides the ad at once and
  // freezes the budget — nothing is consumed and nothing is charged
  // while paused — and resuming spends nothing extra.
  async function toggleAdPause(h) {
    const res = await fetch('/api/ads/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: h.id, paused: !h.adPaused }),
    });
    if (res.ok && me) load(me.username);
  }

  useEffect(() => {
    const session = getSession();
    setMe(session);
    setLoaded(true);
    if (session) {
      load(session.username);
      fetch('/api/payments')
        .then((r) => r.json())
        .then((d) => setPendingAds(Object.fromEntries((d.payments || []).filter((p) => p.kind === 'advertising' && p.status === 'pending').map((p) => [p.listingId, p]))))
        .catch(() => {});
    }
    fetch('/api/settings').then((r) => r.json()).then(setDestination).catch(() => {});
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
    if (res.ok) {
      load(me.username);
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error === 'listing_limit' ? t.listingLimitReached.replace('{limit}', data.limit) : t.deleteListingFailed);
  }

  function refreshUsage() {
    getMyAccount().then((a) => setUsage(a?.listings || null)).catch(() => {});
  }

  // Sold / leased: out of search now, deleted for good in 48 hours. That
  // window is the undo — `restore` cancels it.
  async function markSold(id, status) {
    if (!window.confirm(status === 'sold' ? t.markSoldConfirm : t.markLeasedConfirm)) return;
    setError('');
    const res = await fetch('/api/listings/sold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) load(me.username);
    else setError(t.deleteListingFailed);
  }

  // Delete for good: the row and its photos leave the server, and so do
  // the conversations and visits about this home. Irreversible, so the
  // confirm text spells out what goes with it.
  async function remove(id) {
    if (!window.confirm(t.deleteListingConfirm)) return;
    setError('');
    const res = await fetch('/api/listings/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      load(me.username);
      return;
    }
    // 409 = a payment for this home is still pending review.
    const data = await res.json().catch(() => ({}));
    setError(data.error === 'payment_pending' ? t.deleteListingPending : t.deleteListingFailed);
  }

  return (
    <>
      <main className="container">
        <Link href={`/${params.locale}/account`}>← {t.account}</Link>
        <h1>{t.library}</h1>
        {usage && usage.limit !== null && (
          <p className={usage.used >= usage.limit ? 'notice' : 'muted'} style={{ margin: '0 0 12px' }}>
            <Icon name="home" /> {usage.used >= usage.limit
              ? t.listingLimitReached.replace('{limit}', usage.limit)
              : t.listingLimitUsage.replace('{used}', usage.used).replace('{limit}', usage.limit)}
          </p>
        )}
        {loaded && !me && (
          <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn" href={`/${params.locale}/signup`}>{t.createAccount}</Link>
            <Link className="btn btn-secondary" href={`/${params.locale}/signin`}>{t.signIn}</Link>
          </p>
        )}
        {error && <p style={{ color: '#dc2626', margin: '0 0 12px', fontWeight: 700 }} role="alert">{error}</p>}
        {loaded && me && homes.length === 0 && <p className="muted">{t.noMyListings}</p>}
        <div className="grid">
          {homes.map((h) => (
            <section key={h.id} className="card">
              {h.photos?.length > 0 ? (
                <img src={photoSrc(h.photos[0], 480)} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
              ) : (
                <div className="house-art" style={{ height: 120 }}>{h.commune}</div>
              )}
              <div className="card-body">
                <p style={{ margin: '0 0 4px' }}><strong>{h.title}</strong></p>
                <p className="muted" style={{ margin: '0 0 4px' }}>{h.commune} · {h.price.toLocaleString()} {h.currency || 'HTG'}</p>
                <p className="muted" style={{ margin: '0 0 4px' }}><Icon name="eye" /> <strong>{(h.views || 0).toLocaleString()}</strong> {t.viewsLabel}</p>
                <p style={{ margin: '0 0 12px' }}>
                  {h.status === 'active' && <span style={{ color: '#15803d', fontWeight: 700 }}>✓ {t.statusLive}</span>}
                  {h.status === 'removed' && <span className="muted">{t.statusRemoved}</span>}
                  {(h.status === 'sold' || h.status === 'leased') && (
                    <>
                      <span style={{ color: '#dc2626', fontWeight: 700 }}>
                        <Icon name="tag" /> {h.status === 'sold' ? t.statusSold : t.statusLeased}
                      </span>
                      {h.deletesAt && (
                        <span className="muted"> · <Icon name="hourglass" /> {t.deletesIn} {hoursLeft(h.deletesAt)}</span>
                      )}
                    </>
                  )}
                </p>
                {h.status === 'active' && h.advertised && (
                  <p style={{ margin: '0 0 8px' }}>
                    <span className="badge"><Icon name="megaphone" /> {t.advertised}</span>
                    {h.advertisedUntil && <span className="muted"> · {t.adUntil} {new Date(h.advertisedUntil).toLocaleDateString(params.locale === 'ht' ? 'fr' : params.locale)}</span>}
                  </p>
                )}
                {h.status === 'active' && h.adCampaign && (h.adPaused || h.adEnded || h.adBalanceHTG != null) && (
                  <p style={{ margin: '0 0 8px' }}>
                    {h.adPaused && <span className="muted">{t.adPausedNote} · </span>}
                    {h.adEnded && <span className="muted">{t.adEndedNote}</span>}
                    {!h.adEnded && h.adBalanceHTG != null && <span>{t.adBalance}: <strong>{h.adBalanceHTG.toLocaleString()} HTG</strong></span>}
                  </p>
                )}
                {h.status === 'active' && pendingAds[h.id] && <p className="muted" style={{ margin: '0 0 8px' }}><Icon name="hourglass" /> {t.adPaymentPending}</p>}
                {adOpen === h.id && !pendingAds[h.id] && (
                  <div className="card" style={{ boxShadow: 'none', marginBottom: 12 }}>
                    <div className="card-body" style={{ display: 'grid', gap: 8 }}>
                      <p className="muted" style={{ margin: 0 }}>{t.adExplain}</p>
                      <PaymentForm
                        kind="advertising"
                        listingId={h.id}
                        destination={destination}
                        strings={t}
                        onSubmitted={(p) => { setPendingAds((prev) => ({ ...prev, [h.id]: p })); setAdOpen(null); }}
                      />
                    </div>
                  </div>
                )}
                <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: 0 }}>
                  {h.status === 'active' && (h.advertised || h.adPaused) && (
                    <button className="btn btn-secondary" type="button" onClick={() => toggleAdPause(h)} style={{ minHeight: 40, padding: '8px 16px' }}><Icon name="megaphone" /> {h.adPaused ? t.adResume : t.adPause}</button>
                  )}
                  {h.status === 'active' && !pendingAds[h.id] && adOpen !== h.id && !h.advertised && !h.adPaused && (
                    <button className="btn btn-secondary" type="button" onClick={() => setAdOpen(h.id)} style={{ minHeight: 40, padding: '8px 16px' }}><Icon name="megaphone" /> {h.advertised ? t.adExtend : t.adStart}</button>
                  )}
                  {h.status === 'active' && (
                    <>
                      <Link className="btn" href={`/${params.locale}/listings/${h.id}`} style={{ minHeight: 40, padding: '8px 16px' }}>{t.viewListing}</Link>
                      <Link className="btn btn-secondary" href={`/${params.locale}/listings/${h.id}/edit`} style={{ minHeight: 40, padding: '8px 16px' }}>{t.editListing}</Link>
                      <button className="btn btn-secondary" type="button" onClick={() => takeDown(h.id)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.takeDown}</button>
                      <button className="btn btn-secondary" type="button" onClick={() => markSold(h.id, h.purpose === 'sale' ? 'sold' : 'leased')} style={{ minHeight: 40, padding: '8px 16px' }}>
                        <Icon name="tag" /> {h.purpose === 'sale' ? t.markSold : t.markLeased}
                      </button>
                    </>
                  )}
                  {h.status !== 'active' && (
                    <button className="btn" type="button" onClick={() => restore(h.id)} style={{ minHeight: 40, padding: '8px 16px' }}>
                      {h.status === 'removed' ? t.restore : t.undoSold}
                    </button>
                  )}
                  <button className="btn btn-danger" type="button" onClick={() => remove(h.id)} style={{ minHeight: 40, padding: '8px 16px' }}><Icon name="trash" /> {t.deleteListing}</button>
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
