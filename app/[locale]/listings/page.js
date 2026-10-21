import Link from 'next/link';
import { getDict } from '@/lib/dictionaries';
import { LISTINGS, filterListings, sortListings } from '@/lib/listings';
import { DEPARTMENTS } from '@/lib/departments';
import Header from '@/components/Header';
import ListingCard from '@/components/ListingCard';
import ListingMap from '@/components/ListingMap';
import SaveSearchButton from '@/components/SaveSearchButton';

// Centris-style search: text search + department + type + price range +
// rooms, with sort. A plain GET form keeps every filter shareable by URL.
export default function Listings({ params, searchParams }) {
  const t = getDict(params.locale);
  const f = {
    q: searchParams.q || '',
    department: searchParams.department || '',
    type: searchParams.type || '',
    minPrice: searchParams.minPrice || '',
    maxPrice: searchParams.maxPrice || '',
    minBeds: searchParams.minBeds || '',
    minBaths: searchParams.minBaths || '',
  };
  const shown = sortListings(filterListings(LISTINGS, f), searchParams.sort || '');
  const view = searchParams.view === 'map' ? 'map' : 'list';
  const qs = new URLSearchParams(searchParams);
  const listHref = (() => { const p = new URLSearchParams(searchParams); p.delete('view'); const s = p.toString(); return `/${params.locale}/listings${s ? `?${s}` : ''}`; })();
  const mapHref = (() => { const p = new URLSearchParams(searchParams); p.set('view', 'map'); return `/${params.locale}/listings?${p.toString()}`; })();
  return (
    <>
      <Header locale={params.locale} browse={t.browse} listHome={t.listHome} favorites={t.favorites} savedSearches={t.savedSearches} nearMe={t.nearMe} />
      <main className="container">
        <h1>{t.browse}</h1>
        <form method="get" className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ display: 'grid', gap: 12 }}>
            <input className="input" name="q" defaultValue={f.q} placeholder={t.searchPlaceholder} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field"><label>{t.department}</label>
                <select className="input" name="department" defaultValue={f.department}>
                  <option value="">{t.all}</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d.id} value={d.id}>{d.id}</option>
                  ))}
                </select>
              </div>
              <div className="field"><label>{t.propertyType}</label>
                <select className="input" name="type" defaultValue={f.type}>
                  <option value="">{t.all}</option>
                  <option value="house">{t.house}</option>
                  <option value="apartment">{t.apartment}</option>
                </select>
              </div>
              <div className="field"><label>{t.minPrice} (HTG)</label>
                <input className="input" type="number" name="minPrice" defaultValue={f.minPrice} />
              </div>
              <div className="field"><label>{t.maxPrice} (HTG)</label>
                <input className="input" type="number" name="maxPrice" defaultValue={f.maxPrice} />
              </div>
              <div className="field"><label>{t.minBeds}</label>
                <input className="input" type="number" name="minBeds" defaultValue={f.minBeds} min="0" />
              </div>
              <div className="field"><label>{t.minBaths}</label>
                <input className="input" type="number" name="minBaths" defaultValue={f.minBaths} min="0" />
              </div>
            </div>
            <div className="field"><label>{t.sortBy}</label>
              <select className="input" name="sort" defaultValue={searchParams.sort || ''}>
                <option value="">{t.sortNewest}</option>
                <option value="price-asc">{t.sortPriceAsc}</option>
                <option value="price-desc">{t.sortPriceDesc}</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" type="submit">{t.filters}</button>
              <Link className="btn btn-secondary" href={`/${params.locale}/listings`}>{t.clearFilters}</Link>
            </div>
          </div>
        </form>
        <p className="muted"><strong>{shown.length}</strong> {t.resultsFound}</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <Link className="btn btn-secondary" href={listHref}>{t.listView}</Link>
          <Link className="btn btn-secondary" href={mapHref}>{t.mapView}</Link>
          <SaveSearchButton savedLabel={t.saveSearch} />
        </div>
        {view === 'map' ? (
          <ListingMap listings={shown} locale={params.locale} perMonth={t.perMonth} />
        ) : (
          <div className="grid grid-2">
            {shown.map((l) => (
              <ListingCard key={l.id} listing={l} locale={params.locale} t={t} />
            ))}
          </div>
        )}
        {shown.length === 0 && <p>{t.notFound}</p>}
        <p className="muted" style={{ marginTop: 32 }}>{t.demoNote}</p>
      </main>
    </>
  );
}
