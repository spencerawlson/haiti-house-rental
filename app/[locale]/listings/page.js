import Link from 'next/link';
import { getDict } from '@/lib/dictionaries';
import { getListings } from '@/lib/listings-server';
import { filterListings, sortListings, resolveDepartmentId } from '@/lib/listings';
import { DEPARTMENTS, departmentName } from '@/lib/departments';
import TabBar from '@/components/TabBar';
import ListingCard from '@/components/ListingCard';
import ListingMap from '@/components/ListingMap';
import SaveSearchButton from '@/components/SaveSearchButton';

// Search (design: docs/design/app-showcase.png, screens 5–6): search pill
// always visible, filters in a fold-out sheet (rent/sale toggle, type,
// department, price, bedroom chips, power/furnished/verified), list or
// price-pin map. A plain GET form keeps every filter shareable by URL.
export const dynamic = 'force-dynamic';

export default async function Listings(props) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const t = getDict(params.locale);
  const base = `/${params.locale}`;
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
  const activeFilters = ['department', 'type', 'minPrice', 'maxPrice', 'minBeds', 'minBaths', 'purpose', 'power24', 'furnished', 'verified'].filter((k) => f[k]).length;
  const withView = (v) => {
    const p = new URLSearchParams(searchParams);
    if (v === 'map') p.set('view', 'map'); else p.delete('view');
    const s = p.toString();
    return `${base}/listings${s ? `?${s}` : ''}`;
  };
  return (
    <>
      <main className="container">
        <h1 className="page-title">{t.browse}</h1>
        <form method="get" style={{ marginBottom: 16 }}>
          <div className="search-pill" role="search">
            <span aria-hidden="true">🔍</span>
            <input name="q" defaultValue={f.q} placeholder={t.searchPlaceholder} aria-label={t.searchPlaceholder} />
            <button type="submit">{t.tabSearch}</button>
          </div>
          {view === 'map' && <input type="hidden" name="view" value="map" />}
          <details className="card" style={{ marginTop: 12 }}>
            <summary style={{ padding: '12px 16px', cursor: 'pointer', fontWeight: 800 }}>
              ⚙️ {t.filters}{activeFilters > 0 ? ` (${activeFilters})` : ''}
            </summary>
            <div className="card-body" style={{ display: 'grid', gap: 14, paddingTop: 4 }}>
              <div className="seg" role="radiogroup" aria-label={t.purpose}>
                <label><input type="radio" name="purpose" value="" defaultChecked={!f.purpose} />{t.all}</label>
                <label><input type="radio" name="purpose" value="rent" defaultChecked={f.purpose === 'rent'} />{t.forRent}</label>
                <label><input type="radio" name="purpose" value="sale" defaultChecked={f.purpose === 'sale'} />{t.forSale}</label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                <div className="field"><label>{t.propertyType}</label>
                  <select className="input" name="type" defaultValue={f.type}>
                    <option value="">{t.all}</option>
                    <option value="house">{t.house}</option>
                    <option value="apartment">{t.apartment}</option>
                    <option value="land">{t.land}</option>
                  </select>
                </div>
                <div className="field"><label>{t.department}</label>
                  <select className="input" name="department" defaultValue={resolveDepartmentId(f.department)}>
                    <option value="">{t.all}</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d.id} value={d.id}>{departmentName(d.id, params.locale)}</option>
                    ))}
                  </select>
                </div>
                <div className="field"><label>{t.minPrice} (HTG)</label>
                  <input className="input" type="number" name="minPrice" defaultValue={f.minPrice} min="0" inputMode="numeric" />
                </div>
                <div className="field"><label>{t.maxPrice} (HTG)</label>
                  <input className="input" type="number" name="maxPrice" defaultValue={f.maxPrice} min="0" inputMode="numeric" />
                </div>
              </div>
              <div className="field"><label>{t.minBeds}</label>
                <div className="seg" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  {['', '1', '2', '3'].map((n) => (
                    <label key={n || 'any'}><input type="radio" name="minBeds" value={n} defaultChecked={f.minBeds === n} />{n ? `${n}+` : t.all}</label>
                  ))}
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
                <button className="btn" type="submit" style={{ flex: 1 }}>{t.applyFilters}</button>
                <Link className="btn btn-secondary" href={`${base}/listings`}>{t.clearFilters}</Link>
              </div>
            </div>
          </details>
        </form>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          <span className="muted" style={{ marginRight: 'auto' }}><strong>{shown.length}</strong> {t.resultsFound}</span>
          <Link className={`chip${view === 'list' ? ' active' : ''}`} href={withView('list')}>☰ {t.listView}</Link>
          <Link className={`chip${view === 'map' ? ' active' : ''}`} href={withView('map')}>🗺 {t.mapView}</Link>
          <SaveSearchButton savedLabel={t.saveSearch} />
        </div>
        {view === 'map' ? (
          <ListingMap listings={shown} locale={params.locale} t={t} />
        ) : (
          <div className="listing-grid">
            {shown.map((l) => (
              <ListingCard key={l.id} listing={l} locale={params.locale} t={t} />
            ))}
          </div>
        )}
        {shown.length === 0 && <p>{t.notFound}</p>}
      </main>
      <TabBar locale={params.locale} />
    </>
  );
}
