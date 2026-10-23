// Structured, optional listing details (Phase 3) — what tenants in Haiti
// ask first: water, power, internet, security, parking, furnished, when
// it is free, the conditions and the extra fees. Stored as one JSONB
// column (`listings.details`) and always passed through sanitizeDetails,
// so only these keys and values ever reach the database. Client-safe.
export const DETAIL_OPTIONS = {
  water: ['city', 'cistern', 'well', 'delivery'],
  electricity: ['edh', 'solar', 'generator', 'none'],
  internet: ['included', 'available', 'none'],
  furnished: ['furnished', 'partly', 'unfurnished'],
  security: ['wall', 'gate', 'guard', 'cameras'],
  amenities: ['ac', 'hot_water', 'kitchen', 'yard', 'balcony', 'terrace', 'laundry', 'pool'],
  // Photo room labels for the gallery tabs (design screen 8).
  photoTag: ['inside', 'outside', 'area'],
};

const oneOf = (v, list) => (list.includes(v) ? v : undefined);
const someOf = (v, list) => (Array.isArray(v) ? [...new Set(v.filter((x) => list.includes(x)))] : []);
const text = (v, max) => String(v ?? '').trim().slice(0, max);

export function sanitizeDetails(input) {
  const d = input && typeof input === 'object' ? input : {};
  const out = {
    water: oneOf(d.water, DETAIL_OPTIONS.water),
    electricity: oneOf(d.electricity, DETAIL_OPTIONS.electricity),
    power24: d.power24 === true || undefined,
    internet: oneOf(d.internet, DETAIL_OPTIONS.internet),
    furnished: oneOf(d.furnished, DETAIL_OPTIONS.furnished),
    security: someOf(d.security, DETAIL_OPTIONS.security),
    amenities: someOf(d.amenities, DETAIL_OPTIONS.amenities),
    parking: Math.max(0, Math.min(20, Math.floor(Number(d.parking) || 0))) || undefined,
    availableFrom: /^\d{4}-\d{2}-\d{2}$/.test(String(d.availableFrom || '')) ? d.availableFrom : undefined,
    conditions: text(d.conditions, 1000) || undefined,
    extraFees: text(d.extraFees, 500) || undefined,
    // { "/uploads/<file>": "inside" | "outside" | "area" }, uploaded photos only.
    photoTags: (() => {
      const src = d.photoTags && typeof d.photoTags === 'object' ? d.photoTags : {};
      const out = {};
      for (const [url, tag] of Object.entries(src).slice(0, 60)) {
        if (/^\/uploads\/[\w.-]+$/.test(url) && DETAIL_OPTIONS.photoTag.includes(tag)) out[url] = tag;
      }
      return Object.keys(out).length ? out : undefined;
    })(),
  };
  if (out.security.length === 0) delete out.security;
  if (out.amenities.length === 0) delete out.amenities;
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

// Dictionary key for an option value, e.g. ('water', 'city') -> 'det_water_city'.
export const optionKey = (field, value) => `det_${field}_${value}`;
