'use client';

import { DETAIL_OPTIONS, optionKey } from '@/lib/listing-details';

// The optional "Details" section of the post/edit forms (Phase 3):
// water, power, internet, security, parking, furnished, availability,
// amenities, conditions and extra fees. Every field is optional; the
// server sanitizes the result (lib/listing-details.js).
export default function ListingDetailsFields({ value, onChange, t }) {
  const d = value || {};
  const set = (k, v) => onChange({ ...d, [k]: v });
  const toggle = (k, opt) => {
    const cur = new Set(d[k] || []);
    if (cur.has(opt)) cur.delete(opt); else cur.add(opt);
    set(k, [...cur]);
  };
  const select = (field) => (
    <div className="field"><label>{t[`det_${field}`]}</label>
      <select className="input" value={d[field] || ''} onChange={(e) => set(field, e.target.value || undefined)}>
        <option value="">—</option>
        {DETAIL_OPTIONS[field].map((o) => <option key={o} value={o}>{t[optionKey(field, o)]}</option>)}
      </select>
    </div>
  );
  const checks = (field) => (
    <fieldset className="field" style={{ border: 'none', padding: 0, margin: 0 }}>
      <legend style={{ marginBottom: 6 }}>{t[`det_${field}`]}</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {DETAIL_OPTIONS[field].map((o) => (
          <label key={o} className="chip" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={(d[field] || []).includes(o)} onChange={() => toggle(field, o)} style={{ marginRight: 6 }} />
            {t[optionKey(field, o)]}
          </label>
        ))}
      </div>
    </fieldset>
  );
  return (
    <section style={{ display: 'grid', gap: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
      <h3 style={{ margin: 0 }}>{t.det_title}</h3>
      <p className="muted" style={{ margin: 0 }}>{t.det_note}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {select('water')}
        {select('electricity')}
        {select('internet')}
        {select('furnished')}
        <div className="field"><label>{t.det_parking}</label>
          <input className="input" type="number" min="0" max="20" value={d.parking || ''} onChange={(e) => set('parking', e.target.value ? Number(e.target.value) : undefined)} />
        </div>
        <div className="field"><label>{t.det_availableFrom}</label>
          <input className="input" type="date" value={d.availableFrom || ''} onChange={(e) => set('availableFrom', e.target.value || undefined)} />
        </div>
      </div>
      <label>
        <input type="checkbox" checked={d.power24 === true} onChange={(e) => set('power24', e.target.checked || undefined)} /> {t.det_power24}
      </label>
      {checks('security')}
      {checks('amenities')}
      <div className="field"><label>{t.det_conditions}</label>
        <textarea className="input" rows={2} maxLength={1000} value={d.conditions || ''} onChange={(e) => set('conditions', e.target.value)} placeholder={t.det_conditionsHint} />
      </div>
      <div className="field"><label>{t.det_extraFees}</label>
        <input className="input" maxLength={500} value={d.extraFees || ''} onChange={(e) => set('extraFees', e.target.value)} placeholder={t.det_extraFeesHint} />
      </div>
    </section>
  );
}
