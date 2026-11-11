'use client';

import Link from 'next/link';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getDict } from '@/lib/dictionaries';
import { getSession } from '@/lib/account';
import TabBar from '@/components/TabBar';
import { PaymentStatus } from '@/components/PaymentForm';
import Icon from '@/components/Icon';
import { photoSrc } from '@/lib/photo-url';

// An advertiser's dashboard: their own picture-ad campaigns, counts
// only (views/clicks used — never who viewed or clicked), a form to
// create a campaign, a MonCash/NatCash payment for each pending one,
// and pause/resume. Signed-out visitors are sent to sign-in, like the
// library sends them to sign-in/sign-up. Follows the library page
// pattern: client state, one open form at a time, reload after each
// action.
//
// The payment form posts DIRECTLY to /api/payments with campaignId:
// PaymentForm cannot carry a campaign (it only sends listingId), and
// the payments route does not forward campaignId yet — see the report.
// Until that wiring lands, a campaign payment submitted here is
// refused by the server (not_allowed); the form still shows the
// server's answer instead of failing silently.
export default function Advertiser(props) {
  const params = use(props.params);
  const t = getDict(params.locale);
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState(null);
  const [pendingPayments, setPendingPayments] = useState({});
  const [destination, setDestination] = useState({ moncashNumber: '', natcashNumber: '' });
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [file, setFile] = useState(null);
  const [creating, setCreating] = useState(false);
  const [payOpen, setPayOpen] = useState(null);
  const [payProvider, setPayProvider] = useState('moncash');
  const [payAmount, setPayAmount] = useState(100);
  const [payPhone, setPayPhone] = useState('');
  const [payError, setPayError] = useState('');
  const [payBusy, setPayBusy] = useState(false);

  function load() {
    fetch('/api/advertisers/campaigns')
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns || []))
      .catch(() => {});
    fetch('/api/advertisers/stats')
      .then((r) => r.json())
      .then((d) => setStats(d.stats || null))
      .catch(() => {});
    fetch('/api/payments')
      .then((r) => r.json())
      .then((d) => setPendingPayments(Object.fromEntries(
        (d.payments || []).filter((p) => p.kind === 'advertising' && p.status === 'pending' && p.campaignId).map((p) => [p.campaignId, p]),
      )))
      .catch(() => {});
  }

  useEffect(() => {
    const session = getSession();
    setMe(session);
    setLoaded(true);
    if (!session) {
      router.replace(`/${params.locale}/signin`);
      return;
    }
    load();
    fetch('/api/settings').then((r) => r.json()).then(setDestination).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createCampaign(e) {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      if (!file) throw new Error('invalid_image');
      const form = new FormData();
      form.append('file', file);
      const up = await fetch('/api/upload', { method: 'POST', body: form });
      if (!up.ok) throw new Error('upload_failed');
      const { url } = await up.json();
      const res = await fetch('/api/advertisers/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, imageUrl: url, linkUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'create_failed');
      }
      setTitle('');
      setLinkUrl('');
      setFile(null);
      load();
    } catch (err) {
      setError(err.message || 'create_failed');
    } finally {
      setCreating(false);
    }
  }

  async function submitPayment(e, campaignId) {
    e.preventDefault();
    setPayError('');
    setPayBusy(true);
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'advertising', campaignId, provider: payProvider, senderPhone: payPhone, amountHTG: payAmount }),
    });
    setPayBusy(false);
    if (!res.ok) {
      const code = (await res.json().catch(() => ({}))).error;
      setPayError(
        code === 'invalid_phone' ? t.payPhoneInvalid
          : code === 'duplicate_reference' ? t.payDuplicate
          : code === 'already_pending' ? t.payAlreadyPending
          : code === 'invalid_amount' ? t.payAmountInvalid
          : code === 'not_allowed' ? t.payError
          : t.payError,
      );
      return;
    }
    const payment = (await res.json()).payment;
    setPendingPayments((prev) => ({ ...prev, [campaignId]: payment }));
    setPayOpen(null);
    setPayPhone('');
  }

  async function togglePause(c) {
    const res = await fetch('/api/ads/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: c.id, paused: !c.paused }),
    });
    if (res.ok) load();
  }

  return (
    <>
      <main className="container">
        <Link href={`/${params.locale}/account`}>← {t.account}</Link>
        <h1>{t.advertiserTitle}</h1>
        {loaded && !me && (
          <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn" href={`/${params.locale}/signup?role=advertiser`}>{t.createAccount}</Link>
            <Link className="btn btn-secondary" href={`/${params.locale}/signin`}>{t.signIn}</Link>
          </p>
        )}
        {stats && (
          <div className="stat-tiles admin-tiles" style={{ marginBottom: 24 }}>
            <div className="stat-tile tone-blue"><span className="stat-icon"><Icon name="eye" /></span><strong>{stats.viewsUsed.toLocaleString()}</strong><span>{t.adCampaignViews}</span></div>
            <div className="stat-tile tone-blue"><span className="stat-icon"><Icon name="eye" /></span><strong>{stats.clicksUsed.toLocaleString()}</strong><span>{t.adCampaignClicks}</span></div>
          </div>
        )}
        {loaded && me && (
          <section className="card" style={{ marginBottom: 24 }}>
            <div className="card-body" style={{ display: 'grid', gap: 10 }}>
              <h2 style={{ margin: 0 }}>{t.adCampaignCreate}</h2>
              <form onSubmit={createCampaign} style={{ display: 'grid', gap: 10 }}>
                <div className="field"><label>{t.adCampaignTitle}</label>
                  <input className="input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div className="field"><label>{t.adCampaignImage}</label>
                  <input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
                </div>
                <div className="field"><label>{t.adCampaignLink}</label>
                  <input className="input" type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" required />
                </div>
                {error && <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>}
                <button className="btn" type="submit" disabled={creating} style={{ minHeight: 40, padding: '8px 16px' }}>{t.adCampaignCreate}</button>
              </form>
            </div>
          </section>
        )}
        {loaded && me && campaigns.length === 0 && <p className="muted">{t.advertiserEmpty}</p>}
        <div className="grid">
          {campaigns.map((c) => (
            <section key={c.id} className="card">
              {c.imageUrl ? (
                <img src={photoSrc(c.imageUrl, 480)} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
              ) : (
                <div className="house-art" style={{ height: 120 }}>{c.title}</div>
              )}
              <div className="card-body">
                <p style={{ margin: '0 0 4px' }}><strong>{c.title}</strong></p>
                <p className="muted" style={{ margin: '0 0 4px' }}>
                  <a href={c.linkUrl} target="_blank" rel="noreferrer">{c.linkUrl}</a>
                </p>
                {c.amountHTG > 0 && <p className="muted" style={{ margin: '0 0 4px' }}>{t.adCampaignAmount}: <strong>{c.amountHTG.toLocaleString()} HTG</strong></p>}
                <p className="muted" style={{ margin: '0 0 4px' }}>
                  <Icon name="eye" /> <strong>{(c.viewsUsed || 0).toLocaleString()}</strong> {t.adCampaignViews}
                  {' · '}<strong>{(c.clicksUsed || 0).toLocaleString()}</strong> {t.adCampaignClicks}
                </p>
                <p style={{ margin: '0 0 12px' }}>
                  {c.status === 'active' && !c.paused && <span style={{ color: '#15803d', fontWeight: 700 }}>✓ {t.adCampaignActive}</span>}
                  {c.status === 'pending' && <span className="muted">{t.adCampaignPending}</span>}
                  {c.paused && <span className="muted">{t.adCampaignPaused}</span>}
                </p>
                {pendingPayments[c.id] && (
                  <div style={{ marginBottom: 12 }}>
                    <PaymentStatus payment={pendingPayments[c.id]} strings={t} locale={params.locale} />
                  </div>
                )}
                {payOpen === c.id && !pendingPayments[c.id] && (
                  <div className="card" style={{ boxShadow: 'none', marginBottom: 12 }}>
                    <div className="card-body" style={{ display: 'grid', gap: 8 }}>
                      <form onSubmit={(e) => submitPayment(e, c.id)} style={{ display: 'grid', gap: 10 }}>
                        <div className="field"><label>{t.adAmount}</label>
                          <input className="input" type="number" min={100} max={1000} step={1} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} required />
                          <span className="muted">{t.adAmountHint}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          <label><input type="radio" checked={payProvider === 'moncash'} onChange={() => setPayProvider('moncash')} /> MonCash</label>
                          <label><input type="radio" checked={payProvider === 'natcash'} onChange={() => setPayProvider('natcash')} /> NatCash</label>
                        </div>
                        <p style={{ margin: 0 }}>
                          1. {t.paySendStep} <strong>{payAmount.toLocaleString()} HTG</strong> → <strong>{(payProvider === 'natcash' ? destination.natcashNumber : destination.moncashNumber) || t.numberNotSet}</strong>
                        </p>
                        <div className="field"><label>2. {t.payReference}</label>
                          <input className="input" type="tel" inputMode="tel" value={payPhone} onChange={(e) => setPayPhone(e.target.value)} placeholder={t.payReferenceHint} required minLength={8} maxLength={20} />
                        </div>
                        {payError && <p style={{ color: '#dc2626', margin: 0 }}>{payError}</p>}
                        <button className="btn" type="submit" disabled={payBusy || !(payProvider === 'natcash' ? destination.natcashNumber : destination.moncashNumber)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.paySubmit}</button>
                      </form>
                    </div>
                  </div>
                )}
                <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: 0 }}>
                  {c.status === 'active' && (
                    <button className="btn btn-secondary" type="button" onClick={() => togglePause(c)} style={{ minHeight: 40, padding: '8px 16px' }}><Icon name="megaphone" /> {c.paused ? t.adResume : t.adPause}</button>
                  )}
                  {c.status === 'pending' && !pendingPayments[c.id] && payOpen !== c.id && (
                    <button className="btn btn-secondary" type="button" onClick={() => setPayOpen(c.id)} style={{ minHeight: 40, padding: '8px 16px' }}><Icon name="megaphone" /> {t.adStart}</button>
                  )}
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
