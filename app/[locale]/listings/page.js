import Link from 'next/link';
import { getDict } from '@/lib/dictionaries';
import { getListings } from '@/lib/listings-server';
import { filterListings, sortListings, resolveDepartmentId } from '@/lib/listings';
import { DEPARTMENTS, departmentName } from '@/lib/departments';
import TabBar from '@/components/TabBar';
import ListingCard from '@/components/ListingCard';
import ListingMap from '@/components/ListingMap';
import SaveSearchButton from '@/components/SaveSearchButton';

// Centris-style search: text search + department + type + price range +
// rooms, with sort. A plain GET form keeps every filter shareable by URL.
export const dynamic = 'force-dynamic';

export default async function Listings({ params, searchParams }) {
  const t = getDict(params.locale);
  const LISTINGS = await getListings();
  const f = {
    q: searchParams.q || '',
    department: searchParams.department || '',
    type: searchParams.type || '',
    minPrice: searchParams.minPrice || '',
    maxPrice: searchParams.maxPrice || '',
    minBeds: searchParams.minBeds || '',
    minBaths: searchParams.minBaths || '',
    purpose: searchParams.purpose || '',
    power24: searchParams.power24 || '',
    furnished: searchParams.furnished || '',
    verified: searchParams.verified || '',
  };
  const shown = sortListings(filterListings(LISTINGS, f), searchParams.sort || '');
  const view = searchParams.view === 'map' ? 'map' : 'list';
  const qs = new URLSearchParams(searchParams);
  const listHref = (() => { const p = new URLSearchParams(searchParams); p.delete('view'); const s = p.toString(); return `/${params.locale}/listings${s ? `?${s}` : ''}`; })();
  const mapHref = (() => { const p = new URLSearchParams(searchParams); p.set('view', 'map'); return `/${params.locale}/listings?${p.toString()}`; })();
  return (
    <>
      <main className="container">
        <h1>{t.browse}</h1>
        <form method="get" className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ display: 'grid', gap: 12 }}>
            <input className="input" name="q" defaultValue={f.q} placeholder={t.searchPlaceholder} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field"><label>{t.department}</label>
                <select className="input" name="department" defaultValue={resolveDepartmentId(f.department)}>
                  <option value="">{t.all}</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d.id} value={d.id}>{departmentName(d.id, params.locale)}</option>
                  ))}
                </select>
              </div>
              <div className="field"><label>{t.propertyType}</label>
                <select className="input" name="type" defaultValue={f.type}>
                  <option value="">{t.all}</option>
                  <option value="house">{t.house}</option>
                  <option value="apartment">{t.apartment}</option>
                  <option value="land">{t.land}</option>
                </select>
              </div>
              <div className="field"><label>{t.purpose}</label>
                <select className="input" name="purpose" defaultValue={f.purpose}>
                  <option value="">{t.all}</option>
                  <option value="rent">{t.forRent}</option>
                  <option value="sale">{t.forSale}</option>
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label className="chip" style={{ cursor: 'pointer' }}><input type="checkbox" name="power24" value="1" defaultChecked={f.power24 === '1'} style={{ marginRight: 6 }} />⚡ {t.det_power24Short}</label>
              <label className="chip" style={{ cursor: 'pointer' }}><input type="checkbox" name="furnished" value="1" defaultChecked={f.furnished === '1'} style={{ marginRight: 6 }} />🛋️ {t.det_furnished_furnished}</label>
              <label className="chip" style={{ cursor: 'pointer' }}><input type="checkbox" name="verified" value="1" defaultChecked={f.verified === '1'} style={{ marginRight: 6 }} />✓ {t.verifiedListing}</label>
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
          <ListingMap listings={shown} locale={params.locale} t={t} />
        ) : (
          <div className="grid grid-2">
            {shown.map((l) => (
              <ListingCard key={l.id} listing={l} locale={params.locale} t={t} />
            ))}
          </div>
        )}
        {shown.length === 0 && <p>{t.notFound}</p>}
      </main>
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
