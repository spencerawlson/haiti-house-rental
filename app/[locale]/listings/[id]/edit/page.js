'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDict } from '@/lib/dictionaries';
import { rentPeriodLabel } from '@/lib/listings';
import { DEPARTMENTS, departmentName } from '@/lib/departments';
import { getSession } from '@/lib/account';
import TabBar from '@/components/TabBar';

// Landlord edit form: every field the creation form sets, pre-filled
// from the listing. Existing photos/videos stay unless removed with ✕;
// newly picked files are uploaded on save and appended. Only the listing
// owner sees this form — anyone else gets a notice, and the API enforces
// the same rule.
export default function EditListing({ params }) {
  const t = getDict(params.locale);
  const router = useRouter();
  const [listing, setListing] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [mine, setMine] = useState(false);
  const [f, setF] = useState(null);
  const [newPhotos, setNewPhotos] = useState([]);
  const [newVideos, setNewVideos] = useState([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch(`/api/listings?id=${encodeURIComponent(params.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const l = d?.listing || null;
        setListing(l);
        setLoaded(true);
        const session = getSession();
        if (l && session && session.username === l.owner) {
          setMine(true);
          setF({
            title: l.title || '',
            description: l.description || '',
            department: l.department || 'ouest',
            commune: l.commune || '',
            priceHTG: String(l.priceHTG ?? ''),
            purpose: l.purpose || 'rent',
            rentPeriod: l.rentPeriod || 'monthly',
            homeType: l.type || 'house',
            areaM2: String(l.areaM2 || ''),
            bedrooms: String(l.bedrooms ?? ''),
            bathrooms: String(l.bathrooms ?? ''),
            advertisedRequested: !!l.advertisedRequested,
            photos: [...(l.photos || [])],
            videos: [...(l.videos || [])],
          });
        }
      })
      .catch(() => setLoaded(true));
  }, [params.id]);

  function set(field, value) {
    setF((prev) => ({ ...prev, [field]: value }));
  }

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
    try {
      const session = getSession();
      const photos = [...f.photos, ...(await uploadAll(newPhotos))];
      const videos = [...f.videos, ...(await uploadAll(newVideos))];
      const res = await fetch('/api/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: params.id,
          username: session?.username,
          title: f.title,
          description: f.description,
          department: f.department,
          commune: f.commune,
          priceHTG: f.priceHTG,
          bedrooms: f.bedrooms,
          bathrooms: f.bathrooms,
          purpose: f.purpose,
          advertisedRequested: f.advertisedRequested,
          type: f.homeType,
          areaM2: f.areaM2,
          rentPeriod: f.rentPeriod,
          photos,
          videos,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      router.push(`/${params.locale}/listings/${params.id}`);
    } catch {
      setStatus(t.editError);
    }
  }

  return (
    <>
      <main className="container">
        <Link href={`/${params.locale}/listings/${params.id}`}>{t.back}</Link>
        <h1>{t.editListing}</h1>
        {loaded && !listing && <p className="muted">{t.notFound}</p>}
        {loaded && listing && !mine && (
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-body">
              <p style={{ margin: '0 0 12px' }}>{t.editNotYours}</p>
              <Link className="btn" href={`/${params.locale}/listings/${params.id}`}>{t.viewListing}</Link>
            </div>
          </div>
        )}
        {loaded && listing && mine && f && (
          <form onSubmit={submit} className="card" style={{ marginTop: 20 }}>
            <div className="card-body" style={{ display: 'grid', gap: 14 }}>
              <div className="field"><label>{t.titleLabel}</label>
                <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} required />
              </div>
              <div className="field"><label>{t.description}</label>
                <textarea className="input" value={f.description} onChange={(e) => set('description', e.target.value)} rows={4} />
              </div>
              <p style={{ margin: 0 }}>{t.purpose}<br />
                <label style={{ marginRight: 16 }}>
                  <input type="radio" name="purpose" value="rent" checked={f.purpose === 'rent'} onChange={() => set('purpose', 'rent')} /> {t.forRent}
                </label>
                <label>
                  <input type="radio" name="purpose" value="sale" checked={f.purpose === 'sale'} onChange={() => set('purpose', 'sale')} /> {t.forSale}
                </label>
              </p>
              <p style={{ margin: 0 }}>{t.propertyType}<br />
                <label style={{ marginRight: 16 }}>
                  <input type="radio" name="hometype" value="house" checked={f.homeType === 'house'} onChange={() => set('homeType', 'house')} /> {t.house}
                </label>
                <label style={{ marginRight: 16 }}>
                  <input type="radio" name="hometype" value="apartment" checked={f.homeType === 'apartment'} onChange={() => set('homeType', 'apartment')} /> {t.apartment}
                </label>
                <label>
                  <input type="radio" name="hometype" value="land" checked={f.homeType === 'land'} onChange={() => set('homeType', 'land')} /> {t.land}
                </label>
              </p>
              <div className="field"><label>{t.department}</label>
                <select className="input" value={f.department} onChange={(e) => set('department', e.target.value)}>
                  {DEPARTMENTS.map((d) => (
                    <option key={d.id} value={d.id}>{departmentName(d.id, params.locale)}</option>
                  ))}
                </select>
              </div>
              <div className="field"><label>{t.commune}</label>
                <input className="input" value={f.commune} onChange={(e) => set('commune', e.target.value)} required />
              </div>
              <div className="field"><label>{t.priceLabel} (HTG{f.purpose === 'rent' ? ` ${rentPeriodLabel(f.rentPeriod, t)}` : ''})</label>
                <input className="input" type="number" value={f.priceHTG} onChange={(e) => set('priceHTG', e.target.value)} required />
              </div>
              {f.purpose === 'rent' && (
                <p style={{ margin: 0 }}>{t.rentPeriod}<br />
                  {['monthly', 'quarterly', 'semiannual', 'annual'].map((p) => (
                    <label key={p} style={{ marginRight: 16 }}>
                      <input type="radio" name="rentperiod" value={p} checked={f.rentPeriod === p} onChange={() => set('rentPeriod', p)} /> {rentPeriodLabel(p, t)}
                    </label>
                  ))}
                </p>
              )}
              {f.homeType === 'land' ? (
                <div className="field"><label>{t.areaM2}</label>
                  <input className="input" type="number" value={f.areaM2} onChange={(e) => set('areaM2', e.target.value)} required />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="field"><label>{t.bedrooms}</label>
                    <input className="input" type="number" value={f.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} />
                  </div>
                  <div className="field"><label>{t.bathrooms}</label>
                    <input className="input" type="number" value={f.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} />
                  </div>
                </div>
              )}
              <div className="field"><label>{t.photosLabel}</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {f.photos.map((src) => (
                    <span key={src} style={{ position: 'relative', display: 'inline-block' }}>
                      <img src={src} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                      <button type="button" onClick={() => set('photos', f.photos.filter((p) => p !== src))} style={{ position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 999, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>✕</button>
                    </span>
                  ))}
                </div>
                <input type="file" accept="image/*" multiple onChange={(e) => setNewPhotos([...e.target.files])} />
              </div>
              <div className="field"><label>{t.videosLabel}</label>
                {f.videos.map((src) => (
                  <p key={src} style={{ margin: '0 0 8px' }}>{src} <button type="button" onClick={() => set('videos', f.videos.filter((v) => v !== src))} style={{ border: 'none', background: 'none', color: '#dc2626', fontWeight: 800, cursor: 'pointer' }}>✕</button></p>
                ))}
                <input type="file" accept="video/*" multiple onChange={(e) => setNewVideos([...e.target.files])} />
              </div>
              <label>
                <input type="checkbox" checked={f.advertisedRequested} onChange={(e) => set('advertisedRequested', e.target.checked)} /> {t.advertiseRequest}
              </label>
              <button className="btn" type="submit">{t.saveChanges}</button>
              {status && <p>{status}</p>}
            </div>
          </form>
        )}
      </main>
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
