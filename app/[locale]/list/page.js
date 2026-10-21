'use client';

import Link from 'next/link';
import { useState } from 'react';
import { getDict } from '@/lib/dictionaries';
import { LISTING_FEE_LABEL, PAYMENT_PROVIDERS } from '@/lib/config';
import { DEPARTMENTS } from '@/lib/departments';

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
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <Link href={`/${params.locale}`}>{t.back}</Link>
      <h1>{t.landlordTitle}</h1>
      <ol>
        <li>{t.landlordStep1}</li>
        <li>{t.landlordStep2}</li>
        <li>{t.landlordStep3}</li>
      </ol>
      <p>{t.feeLabel}: <strong>{LISTING_FEE_LABEL}</strong> — {t.feeTbd}</p>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12, marginTop: 24 }}>
        <label>{t.titleLabel}<br />
          <input value={title} onChange={(e) => setTitle(e.target.value)} required style={{ width: '100%', padding: 8 }} />
        </label>
        <label>{t.department}<br />
          <select value={department} onChange={(e) => setDepartment(e.target.value)} style={{ padding: 8 }}>
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>{d.id}</option>
            ))}
          </select>
        </label>
        <label>{t.commune}<br />
          <input value={commune} onChange={(e) => setCommune(e.target.value)} required style={{ width: '100%', padding: 8 }} />
        </label>
        <label>{t.priceLabel}<br />
          <input type="number" value={priceHTG} onChange={(e) => setPriceHTG(e.target.value)} required style={{ padding: 8 }} /> HTG {t.perMonth}
        </label>
        <label>{t.bedrooms}<br />
          <input type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} style={{ padding: 8 }} />
        </label>
        <label>{t.bathrooms}<br />
          <input type="number" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} style={{ padding: 8 }} />
        </label>
        <label>{t.phoneLabel}<br />
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+509 ____ ____" style={{ width: '100%', padding: 8 }} />
        </label>
        <p>{t.providerLabel}<br />
          {PAYMENT_PROVIDERS.map((p) => (
            <label key={p} style={{ marginRight: 16 }}>
              <input type="radio" name="provider" value={p} checked={provider === p} onChange={() => setProvider(p)} /> {p}
            </label>
          ))}
        </p>
        <label>{t.photosLabel}<br />
          <input type="file" accept="image/*" multiple onChange={(e) => setPhotoFiles([...e.target.files])} />
        </label>
        <label>{t.videosLabel}<br />
          <input type="file" accept="video/*" multiple onChange={(e) => setVideoFiles([...e.target.files])} />
        </label>
        <button type="submit" style={{ padding: 12 }}>{t.publish}</button>
        {status && <p>{status}</p>}
        {createdId && (
          <p><Link href={`/${params.locale}/listings/${createdId}`}>{t.viewListing}</Link></p>
        )}
      </form>
      <p style={{ marginTop: 24, color: '#666' }}>{t.activationNote}</p>
    </main>
  );
}
