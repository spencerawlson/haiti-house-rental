'use client';

import Link from 'next/link';
import { useEffect, useState, use } from 'react';
import { getDict } from '@/lib/dictionaries';
import { DEPARTMENTS, departmentName, communeName } from '@/lib/departments';
import { SHOP_SECTIONS, shopCategoriesFor, shopSectionLabel, shopCategoryLabel } from '@/lib/shop';
import { getMyAccount } from '@/lib/account';
import { compressImage } from '@/lib/image-compress';
import TabBar from '@/components/TabBar';
import Icon from '@/components/Icon';

// Seller post form (Nov 2026): the SIMPLIFIED Shop form. A seller
// posts a furniture/electronics item — title, exactly one section and
// one category in it, price in HTG, commune, description, photos.
// No bedrooms, no bathrooms, no rent period: those are house fields
// and are never asked for here. The server forces kind='furniture'
// from the seller's role and rejects a client-supplied kind, so this
// form sends no kind at all.
export default function ShopPost(props) {
  const params = use(props.params);
  const t = getDict(params.locale);
  const base = `/${params.locale}`;
  const [me, setMe] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState('');
  const [section, setSection] = useState('furniture');
  const [category, setCategory] = useState('tables');
  const [price, setPrice] = useState('');
  const [department, setDepartment] = useState('ouest');
  const [commune, setCommune] = useState('');
  const [description, setDescription] = useState('');
  const [photoFiles, setPhotoFiles] = useState([]);
  const [status, setStatus] = useState('');
  const [createdId, setCreatedId] = useState('');

  useEffect(() => {
    getMyAccount().then((a) => { setMe(a); setLoaded(true); });
  }, []);

  useEffect(() => {
    const cats = shopCategoriesFor(section);
    if (!cats.includes(category)) setCategory(cats[0] || '');
  }, [section]);

  const sectionLabel = (id) => shopSectionLabel(t, id);
  const categoryLabel = (cat) => shopCategoryLabel(t, cat);
  const communes = DEPARTMENTS.find((d) => d.id === department)?.communes || [];

  async function uploadAll(files) {
    const urls = [];
    for (const file of files) {
      const form = new FormData();
      form.append('file', await compressImage(file));
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error('Upload failed');
      urls.push((await res.json()).url);
    }
    return urls;
  }

  async function submit(e) {
    e.preventDefault();
    setStatus(t.uploading);
    setCreatedId('');
    try {
      const photos = await uploadAll(photoFiles);
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, department, commune, price, currency: 'HTG', photos, videos: [], shopSection: section, shopCategory: category, purpose: 'sale' }),
      });
      const err = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(err.error === 'invalid_shop_category' ? t.shopNoItems : t.listingError);
        return;
      }
      setCreatedId(err.listing.id);
      setStatus(t.listingCreated);
    } catch {
      setStatus(t.listingError);
    }
  }

  return (
    <>
      <main className="container">
        <Link href={`${base}/shop`}>{t.back}</Link>
        <h1 className="page-title">{t.shopPostItem}</h1>
        {loaded && !me && (
          <div className="card"><div className="card-body">
            <p style={{ margin: '0 0 12px' }}>{t.signInToPost}</p>
            <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: 0 }}>
              <Link className="btn" href={`${base}/signin`}>{t.signIn}</Link>
              <Link className="btn btn-secondary" href={`${base}/signup?role=seller`}>{t.createAccount}</Link>
            </p>
          </div></div>
        )}
        {loaded && me && me.role !== 'seller' && (
          <div className="card"><div className="card-body">
            <p style={{ margin: '0 0 12px' }}>{t.shopBecomeSeller}</p>
            <p style={{ margin: 0 }}><Link className="btn" href={`${base}/signup?role=seller`}>{t.createAccount}</Link></p>
          </div></div>
        )}
        {loaded && me && me.role === 'seller' && !me.activated && (
          <div className="card"><div className="card-body">
            <p style={{ margin: 0 }}><Icon name="hourglass" /> {t.waitingActivation}</p>
            <p style={{ margin: '12px 0 0' }}><Link className="btn" href={`${base}/account`}>{t.account}</Link></p>
          </div></div>
        )}
        {loaded && me && me.role === 'seller' && me.activated && (
          <form onSubmit={submit} className="card" style={{ marginTop: 20 }}>
            <div className="card-body" style={{ display: 'grid', gap: 14 }}>
              <div className="field"><label>{t.titleLabel}</label>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="field"><label>{t.shopSectionsTitle}</label>
                <select className="input" value={section} onChange={(e) => setSection(e.target.value)}>
                  {SHOP_SECTIONS.map((s) => (<option key={s.id} value={s.id}>{sectionLabel(s.id)}</option>))}
                </select>
              </div>
              <div className="field"><label>{t.shopSectionsTitle}</label>
                <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {shopCategoriesFor(section).map((c) => (<option key={c} value={c}>{categoryLabel(c)}</option>))}
                </select>
              </div>
              <div className="field"><label>{t.priceLabel || 'Pri'}</label>
                <input className="input" type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} required />
              </div>
              <div className="field"><label>{t.department}</label>
                <select className="input" value={department} onChange={(e) => setDepartment(e.target.value)}>
                  {DEPARTMENTS.map((d) => (<option key={d.id} value={d.id}>{departmentName(d.id, params.locale)}</option>))}
                </select>
              </div>
              <div className="field"><label>{t.commune}</label>
                <select className="input" value={commune} onChange={(e) => setCommune(e.target.value)} required>
                  <option value="">{t.commune}</option>
                  {communes.map((c) => (<option key={c} value={c}>{communeName(c, params.locale)}</option>))}
                </select>
              </div>
              <div className="field"><label>{t.description}</label>
                <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
              </div>
              <div className="field"><label>{t.photosTitle}</label>
                <input className="input" type="file" accept="image/*" multiple onChange={(e) => setPhotoFiles([...e.target.files])} />
              </div>
              {status && <p>{status}</p>}
              {createdId && <p><Link href={`${base}/listings/${createdId}`}>{t.shopBrowse} ›</Link></p>}
              <button className="btn" type="submit">{t.shopPostItem}</button>
            </div>
          </form>
        )}
      </main>
      <TabBar locale={params.locale} />
    </>
  );
}
