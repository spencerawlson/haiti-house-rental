'use client';

import Link from 'next/link';
import { useEffect, useState, use } from 'react';
import { getDict } from '@/lib/dictionaries';
import { rentPeriodLabel } from '@/lib/listings';
import { JOIN_FEE_HTG, QUARTER_FEE_HTG, ADVERTISED_FEE_HTG_MONTH, PAYMENT_PROVIDERS } from '@/lib/config';
import { DEPARTMENTS, departmentName } from '@/lib/departments';
import { getSession, getMyAccount } from '@/lib/account';
import TabBar from '@/components/TabBar';
import ListingDetailsFields from '@/components/ListingDetailsFields';
import { compressImage } from '@/lib/image-compress';

// Landlord posting form: details + description + house photos and videos.
// Only an activated landlord account can post — tenants explore, they
// never see this form, and the API enforces the same rule.
export default function ListHome(props) {
  const params = use(props.params);
  const t = getDict(params.locale);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('ouest');
  const [commune, setCommune] = useState('');
  const [priceHTG, setPriceHTG] = useState('');
  const [purpose, setPurpose] = useState('rent');
  const [rentPeriod, setRentPeriod] = useState('monthly');
  const [homeType, setHomeType] = useState('house');
  const [areaM2, setAreaM2] = useState('');
  const [advertisedRequested, setAdvertisedRequested] = useState(false);
  const [details, setDetails] = useState({});
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [phone, setPhone] = useState('');
  const [provider, setProvider] = useState('moncash');
  const [photoFiles, setPhotoFiles] = useState([]);
  const [videoFiles, setVideoFiles] = useState([]);
  const [status, setStatus] = useState('');
  const [createdId, setCreatedId] = useState('');
  const [myUsername, setMyUsername] = useState(null);
  const [me, setMe] = useState(null);
  const [meLoaded, setMeLoaded] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (session) setMyUsername(session.username);
    getMyAccount().then((a) => { setMe(a); setMeLoaded(true); });
  }, []);

  async function uploadAll(files) {
    const urls = [];
    for (const file of files) {
      const form = new FormData();
      form.append('file', await compressImage(file));
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      urls.push(data.url);
    }
    return urls;
  }

  async function submit(e) {
    e.preventDefault();
    setStatus(t.uploading);
    setCreatedId('');
    try {
      const photos = await uploadAll(photoFiles);
      const videos = await uploadAll(videoFiles);
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, department, commune, priceHTG, bedrooms, bathrooms, photos, videos, purpose, advertisedRequested, type: homeType, areaM2, rentPeriod, details }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.error === 'listing_limit') {
          setStatus(t.listingLimitReached.replace('{limit}', err.limit));
          return;
        }
        throw new Error('Create failed');
      }
      const data = await res.json();
      setCreatedId(data.listing.id);
      // One more home live: keep the usage line honest without a reload.
      setMe((m) => (m?.listings ? { ...m, listings: { ...m.listings, used: m.listings.used + 1 } } : m));
      setStatus(t.listingCreated);
    } catch {
      setStatus(t.listingError);
    }
  }

  return (
    <>
      <main className="container">
      <Link href={`/${params.locale}`}>{t.back}</Link>
      <h1>{t.landlordTitle}</h1>
      <ol className="muted">
        <li>{t.landlordStep1}</li>
        <li>{t.landlordStep2}</li>
        <li>{t.landlordStep3}</li>
      </ol>
      <p>{t.activationFee}: <strong>{JOIN_FEE_HTG.toLocaleString()} HTG</strong> ({t.oneTime}) · <strong>{QUARTER_FEE_HTG.toLocaleString()} HTG</strong> {t.quarterFeeLabel}</p>
      <p className="muted">{t.advertisedFee}: <strong>{ADVERTISED_FEE_HTG_MONTH} HTG {t.perMonth}</strong></p>
      {myUsername && <p>{t.postingAs} <strong>@{myUsername}</strong></p>}
      {meLoaded && !me && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-body">
            <p style={{ margin: '0 0 12px' }}>{t.signInToPost}</p>
            <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: 0 }}>
              <Link className="btn" href={`/${params.locale}/signin`}>{t.signIn}</Link>
              <Link className="btn btn-secondary" href={`/${params.locale}/signup?role=landlord`}>{t.createAccount}</Link>
            </p>
          </div>
        </div>
      )}
      {meLoaded && me && me.role === 'tenant' && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-body">
            <p style={{ margin: '0 0 12px' }}>{t.landlordsOnly}</p>
            <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: 0 }}>
              <Link className="btn" href={`/${params.locale}/listings`}>{t.browse}</Link>
              <Link className="btn btn-secondary" href={`/${params.locale}/signup?role=landlord`}>{t.createAccount}</Link>
            </p>
          </div>
        </div>
      )}
      {meLoaded && me && me.role === 'landlord' && !me.activated && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-body">
            <p style={{ margin: '0 0 12px' }}>⏳ {t.waitingActivation}</p>
            <p style={{ margin: 0 }}>
              <Link className="btn" href={`/${params.locale}/account`}>{t.account}</Link>
            </p>
          </div>
        </div>
      )}
      {/* Listing limit (set by the admin, e.g. for partner accounts):
          show the usage, and hide the form once it is full — before any
          photo is uploaded. The server enforces it either way. */}
      {meLoaded && me?.activated && me.listings?.limit !== null && me.listings?.limit !== undefined && (
        <p className={me.listings.used >= me.listings.limit ? 'notice' : 'muted'} style={{ marginTop: 20 }}>
          🏠 {me.listings.used >= me.listings.limit
            ? t.listingLimitReached.replace('{limit}', me.listings.limit)
            : t.listingLimitUsage.replace('{used}', me.listings.used).replace('{limit}', me.listings.limit)}
        </p>
      )}
      {meLoaded && me && me.role === 'landlord' && me.activated && !(me.listings?.limit !== null && me.listings?.limit !== undefined && me.listings.used >= me.listings.limit) && (
      <form onSubmit={submit} className="card" style={{ marginTop: 20 }}>
        <div className="card-body" style={{ display: 'grid', gap: 14 }}>
        <div className="field"><label>{t.titleLabel}</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="field"><label>{t.description}</label>
          <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        </div>
        <p style={{ margin: 0 }}>{t.purpose}<br />
          <label style={{ marginRight: 16 }}>
            <input type="radio" name="purpose" value="rent" checked={purpose === 'rent'} onChange={() => setPurpose('rent')} /> {t.forRent}
          </label>
          <label>
            <input type="radio" name="purpose" value="sale" checked={purpose === 'sale'} onChange={() => setPurpose('sale')} /> {t.forSale}
          </label>
        </p>
        <p style={{ margin: 0 }}>{t.propertyType}<br />
          <label style={{ marginRight: 16 }}>
            <input type="radio" name="hometype" value="house" checked={homeType === 'house'} onChange={() => setHomeType('house')} /> {t.house}
          </label>
          <label style={{ marginRight: 16 }}>
            <input type="radio" name="hometype" value="apartment" checked={homeType === 'apartment'} onChange={() => setHomeType('apartment')} /> {t.apartment}
          </label>
          <label>
            <input type="radio" name="hometype" value="land" checked={homeType === 'land'} onChange={() => setHomeType('land')} /> {t.land}
          </label>
        </p>
        <div className="field"><label>{t.department}</label>
          <select className="input" value={department} onChange={(e) => setDepartment(e.target.value)}>
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>{departmentName(d.id, params.locale)}</option>
            ))}
          </select>
        </div>
        <div className="field"><label>{t.commune}</label>
          <input className="input" value={commune} onChange={(e) => setCommune(e.target.value)} required />
        </div>
        <div className="field"><label>{t.priceLabel} (HTG{purpose === 'rent' ? ` ${rentPeriodLabel(rentPeriod, t)}` : ''})</label>
          <input className="input" type="number" value={priceHTG} onChange={(e) => setPriceHTG(e.target.value)} required />
        </div>
        {purpose === 'rent' && (
          <p style={{ margin: 0 }}>{t.rentPeriod}<br />
            {['monthly', 'quarterly', 'semiannual', 'annual'].map((p) => (
              <label key={p} style={{ marginRight: 16 }}>
                <input type="radio" name="rentperiod" value={p} checked={rentPeriod === p} onChange={() => setRentPeriod(p)} /> {rentPeriodLabel(p, t)}
              </label>
            ))}
          </p>
        )}
        {homeType === 'land' ? (
          <div className="field"><label>{t.areaM2}</label>
            <input className="input" type="number" value={areaM2} onChange={(e) => setAreaM2(e.target.value)} required />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field"><label>{t.bedrooms}</label>
            <input className="input" type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
          </div>
          <div className="field"><label>{t.bathrooms}</label>
            <input className="input" type="number" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} />
          </div>
          </div>
        )}
        <div className="field"><label>{t.phoneLabel}</label>
          <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+509 ____ ____" />
        </div>
        <p style={{ margin: 0 }}>{t.providerLabel}<br />
          {PAYMENT_PROVIDERS.map((p) => (
            <label key={p} style={{ marginRight: 16 }}>
              <input type="radio" name="provider" value={p} checked={provider === p} onChange={() => setProvider(p)} /> {p}
            </label>
          ))}
        </p>
        <ListingDetailsFields value={details} onChange={setDetails} t={t} />
        <div className="field"><label>{t.photosLabel}</label>
          <input type="file" accept="image/*" multiple onChange={(e) => setPhotoFiles([...e.target.files])} />
        </div>
        <div className="field"><label>{t.videosLabel}</label>
          <input type="file" accept="video/*" multiple onChange={(e) => setVideoFiles([...e.target.files])} />
        </div>
        <label>
          <input type="checkbox" checked={advertisedRequested} onChange={(e) => setAdvertisedRequested(e.target.checked)} /> {t.advertiseRequest}
        </label>
        <button className="btn" type="submit">{t.publish}</button>
        {status && <p>{status}</p>}
        {createdId && (
          <p><Link href={`/${params.locale}/listings/${createdId}`}>{t.viewListing}</Link></p>
        )}
        </div>
      </form>)}
      <p className="muted" style={{ marginTop: 24 }}>{t.activationNote}</p>
      </main>
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
