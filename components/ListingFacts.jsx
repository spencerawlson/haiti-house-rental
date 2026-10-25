import { optionKey } from '@/lib/listing-details';
import Icon from '@/components/Icon';

// Listing details on the detail page (design: docs/design/app-showcase.png,
// screen 7 — four tiles for water, electricity, internet, security, then
// the rest as a list). Renders nothing for fields the landlord left empty.
export default function ListingFacts({ details, t, locale }) {
  const d = details || {};
  const tiles = [
    d.water && { icon: 'water', label: t.det_water, value: t[optionKey('water', d.water)] },
    (d.electricity || d.power24) && {
      icon: 'power',
      label: t.det_electricity,
      value: [d.electricity && t[optionKey('electricity', d.electricity)], d.power24 && t.det_power24Short].filter(Boolean).join(' · '),
    },
    d.internet && { icon: 'wifi', label: t.det_internet, value: t[optionKey('internet', d.internet)] },
    d.security?.length && { icon: 'shield', label: t.det_security, value: d.security.map((s) => t[optionKey('security', s)]).join(', ') },
  ].filter(Boolean);
  const rows = [
    d.furnished && [t.det_furnished, t[optionKey('furnished', d.furnished)]],
    d.parking && [t.det_parking, String(d.parking)],
    d.availableFrom && [t.det_availableFrom, new Date(`${d.availableFrom}T12:00:00Z`).toLocaleDateString(locale === 'ht' ? 'fr' : locale)],
    d.amenities?.length && [t.det_amenities, d.amenities.map((a) => t[optionKey('amenities', a)]).join(' · ')],
    d.conditions && [t.det_conditions, d.conditions],
    d.extraFees && [t.det_extraFees, d.extraFees],
  ].filter(Boolean);
  if (tiles.length === 0 && rows.length === 0) return null;
  return (
    <section style={{ marginTop: 16, display: 'grid', gap: 12 }}>
      {tiles.length > 0 && (
        <div className="fact-tiles">
          {tiles.map((tile) => (
            <div key={tile.label} className="fact-tile">
              <span className="fact-icon" aria-hidden="true"><Icon name={tile.icon} /></span>
              <span className="fact-label">{tile.label}</span>
              <span className="fact-value">{tile.value}</span>
            </div>
          ))}
        </div>
      )}
      {rows.length > 0 && (
        <dl className="card fact-list">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="muted">{k}</dt>
              <dd style={{ whiteSpace: 'pre-wrap' }}>{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
