'use client';

import Link from 'next/link';
import { useState } from 'react';
import { getDict } from '@/lib/dictionaries';
import { LISTING_FEE_LABEL, PAYMENT_PROVIDERS } from '@/lib/config';
import { DEPARTMENTS } from '@/lib/departments';
import Header from '@/components/Header';

// Landlord posting form: details + house photos and videos.
// v0: uploads go to /api/upload (server disk), then the listing is created
// via /api/listings. Payment activation is NOT enforced yet — it arrives with
// landlord accounts (see SPEC.md).
export default function ListHome({ params }) {
  const t = getDict(params.locale);
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('ouest');
  const [commune, setCommune] = useState('');
  const [priceHTG, setPriceHTG] = useState('');
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [phone, setPhone] = useState('');
  const [provider, setProvider] = useState('moncash');
  const [photoFiles, setPhotoFiles] = useState([]);
  const [videoFiles, setVideoFiles] = useState([]);
  const [status, setStatus] = useState('');
  const [createdId, setCreatedId] = useState('');

  async function uploadAll(files) {
    const urls = [];
    for (const file of files) {
      const form = new FormData();
      form.append('file', file);
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
        body: JSON.stringify({ title, department, commune, priceHTG, bedrooms, bathrooms, photos, videos }),
      });
      if (!res.ok) throw new Error('Create failed');
      const data = await res.json();
      setCreatedId(data.listing.id);
      setStatus(t.listingCreated);
    } catch {
      setStatus(t.listingError);
    }
  }

  return (
    <>
      <Header locale={params.locale} browse={t.browse} listHome={t.listHome} favorites={t.favorites} savedSearches={t.savedSearches} nearMe={t.nearMe} />
      <main className="container">
      <Link href={`/${params.locale}`}>{t.back}</Link>
      <h1>{t.landlordTitle}</h1>
      <ol className="muted">
        <li>{t.landlordStep1}</li>
        <li>{t.landlordStep2}</li>
        <li>{t.landlordStep3}</li>
      </ol>
      <p>{t.feeLabel}: <strong>{LISTING_FEE_LABEL}</strong> — {t.feeTbd}</p>
      <form onSubmit={submit} className="card" style={{ marginTop: 20 }}>
        <div className="card-body" style={{ display: 'grid', gap: 14 }}>
        <div className="field"><label>{t.titleLabel}</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="field"><label>{t.department}</label>
          <select className="input" value={department} onChange={(e) => setDepartment(e.target.value)}>
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>{d.id}</option>
            ))}
          </select>
        </div>
        <div className="field"><label>{t.commune}</label>
          <input className="input" value={commune} onChange={(e) => setCommune(e.target.value)} required />
        </div>
        <div className="field"><label>{t.priceLabel} (HTG {t.perMonth})</label>
          <input className="input" type="number" value={priceHTG} onChange={(e) => setPriceHTG(e.target.value)} required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field"><label>{t.bedrooms}</label>
          <input className="input" type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
        </div>
        <div className="field"><label>{t.bathrooms}</label>
          <input className="input" type="number" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} />
        </div>
        </div>
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
        <div className="field"><label>{t.photosLabel}</label>
          <input type="file" accept="image/*" multiple onChange={(e) => setPhotoFiles([...e.target.files])} />
        </div>
        <div className="field"><label>{t.videosLabel}</label>
          <input type="file" accept="video/*" multiple onChange={(e) => setVideoFiles([...e.target.files])} />
        </div>
        <button className="btn" type="submit">{t.publish}</button>
        {status && <p>{status}</p>}
        {createdId && (
          <p><Link href={`/${params.locale}/listings/${createdId}`}>{t.viewListing}</Link></p>
        )}
        </div>
      </form>
      <p className="muted" style={{ marginTop: 24 }}>{t.activationNote}</p>
      </main>
    </>
  );
}
