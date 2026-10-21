'use client';

import { useEffect, useState } from 'react';
import { getDict } from '@/lib/dictionaries';

// Admin: approve or remove featured placement. Nothing here is automatic —
// a landlord's featured checkbox is only a request until the admin approves.
// v0: this page has no login. Gate it before launch.
export default function Admin({ params }) {
  const t = getDict(params.locale);
  const [listings, setListings] = useState([]);

  async function load() {
    const res = await fetch('/api/listings');
    if (res.ok) {
      const data = await res.json();
      setListings(data.listings);
    }
  }

  useEffect(() => { load(); }, []);

  async function set(id, featured) {
    await fetch('/api/admin/featured', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, featured }),
    });
    load();
  }

  return (
    <main className="container">
      <h1>{t.adminTitle}</h1>
      <p className="muted">{t.adminNote}</p>
      <div className="grid">
        {listings.map((l) => (
          <section key={l.id} className="card">
            <div className="card-body">
              <h3 style={{ margin: '0 0 4px' }}>{l.title}</h3>
              <p className="muted" style={{ margin: '0 0 8px' }}>
                {l.commune} · {l.priceHTG.toLocaleString()} HTG
                {l.purpose === 'rent' ? ` ${t.perMonth}` : ''}
                {l.featured && <> · <span className="badge">★ {t.featured}</span></>}
                {l.featuredRequested && !l.featured && <> · <span className="badge">{t.requestedBadge}</span></>}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                {!l.featured && (
                  <button className="btn" type="button" onClick={() => set(l.id, true)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.approveFeatured}</button>
                )}
                {l.featured && (
                  <button className="btn btn-secondary" type="button" onClick={() => set(l.id, false)} style={{ minHeight: 40, padding: '8px 16px' }}>{t.removeFeatured}</button>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
