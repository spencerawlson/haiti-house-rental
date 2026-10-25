'use client';

import Link from 'next/link';
import { useEffect, useState, use } from 'react';
import { getDict } from '@/lib/dictionaries';
import { matchesQuery, resolveDepartmentId } from '@/lib/listings';
import { readSavedSearches, SAVED_KEY } from '@/components/SaveSearchButton';
import TabBar from '@/components/TabBar';
import ListingCard from '@/components/ListingCard';
import Icon from '@/components/Icon';

// Centris-style alerts, without accounts: every saved search re-runs against
// the live listings, and listings created after the search was saved are
// flagged as new.
function matches(listing, query) {
  const p = new URLSearchParams(query);
  const q = p.get('q') || '';
  if (q && !matchesQuery(listing, q)) return false;
  const dept = resolveDepartmentId(p.get('department'));
  if (dept && listing.department !== dept) return false;
  if (p.get('type') && listing.type !== p.get('type')) return false;
  if (p.get('purpose') && listing.purpose !== p.get('purpose')) return false;
  if (p.get('minPrice') && listing.priceHTG < Number(p.get('minPrice'))) return false;
  if (p.get('maxPrice') && listing.priceHTG > Number(p.get('maxPrice'))) return false;
  if (p.get('minBeds') && listing.bedrooms < Number(p.get('minBeds'))) return false;
  if (p.get('minBaths') && listing.bathrooms < Number(p.get('minBaths'))) return false;
  return true;
}

export default function SavedSearches(props) {
  const params = use(props.params);
  const t = getDict(params.locale);
  const [searches, setSearches] = useState(null);
  const [listings, setListings] = useState([]);

  useEffect(() => {
    setSearches(readSavedSearches());
    fetch('/api/listings')
      .then((r) => r.json())
      .then((d) => setListings(d.listings))
      .catch(() => setListings([]));
  }, []);

  function remove(query) {
    const next = readSavedSearches().filter((s) => s.query !== query);
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    setSearches(next);
  }

  return (
    <>
      <main className="container">
        <h1 className="page-title"><Icon name="bell" /> {t.savedSearches}</h1>
        {searches === null && <p>...</p>}
        {searches?.length === 0 && <p>{t.noSavedSearches}</p>}
        {(searches || []).map((s) => {
          const found = listings.filter((l) => matches(l, s.query));
          const fresh = found.filter((l) => l.createdAt && l.createdAt > s.createdAt);
          return (
            <section key={s.query} className="card" style={{ marginBottom: 20 }}>
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <h2 style={{ margin: 0 }}>{s.label}</h2>
                  <button className="btn btn-secondary" type="button" onClick={() => remove(s.query)} style={{ minHeight: 36, padding: '6px 12px' }}>✕</button>
                </div>
                <p className="muted">
                  {found.length} {t.resultsFound}
                  {fresh.length > 0 && <> · <strong style={{ color: '#1d4ed8' }}>{fresh.length} {t.newMatches}</strong></>}
                </p>
                <p>
                  <Link href={`/${params.locale}/listings?${s.query}`}>{t.viewSearch}</Link>
                </p>
                <div className="grid grid-2">
                  {found.slice(0, 4).map((l) => (
                    <ListingCard key={l.id} listing={l} locale={params.locale} t={t} />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </main>
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
