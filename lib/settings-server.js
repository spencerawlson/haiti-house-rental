// Payment destination numbers — Postgres (since Oct 2026). The
// registration fee is transferred TO these numbers: the Digicel number
// for MonCash, the Natcom number for NatCash. Both are set from the Admin
// Board, never hardcoded.
import { query } from './db';

export async function getSettings(q = query) {
  const { rows } = await q('SELECT * FROM settings WHERE id = 1');
  const r = rows[0] || {};
  return {
    moncashNumber: r.moncash_number || '',
    natcashNumber: r.natcash_number || '',
    // Advertising rate: what 100 HTG buys. The admin changes these from
    // the Admin Board as the site grows, without a code change. The rate
    // is admin-only knowledge — the public settings endpoint strips it,
    // because the rate would reveal the hidden ad budgets to landlords.
    adViewsPer100: r.ad_views_per_100 != null ? Number(r.ad_views_per_100) : 1000,
    adClicksPer100: r.ad_clicks_per_100 != null ? Number(r.ad_clicks_per_100) : 200,
  };
}

export async function setSettings({ moncashNumber, natcashNumber, adViewsPer100, adClicksPer100 }) {
  const current = await getSettings();
  const next = {
    moncashNumber: typeof moncashNumber === 'string' ? moncashNumber.trim() : current.moncashNumber,
    natcashNumber: typeof natcashNumber === 'string' ? natcashNumber.trim() : current.natcashNumber,
    adViewsPer100: Number.isInteger(adViewsPer100) && adViewsPer100 >= 0 ? adViewsPer100 : current.adViewsPer100,
    adClicksPer100: Number.isInteger(adClicksPer100) && adClicksPer100 >= 0 ? adClicksPer100 : current.adClicksPer100,
  };
  await query('UPDATE settings SET moncash_number = $1, natcash_number = $2, ad_views_per_100 = $3, ad_clicks_per_100 = $4 WHERE id = 1', [next.moncashNumber, next.natcashNumber, next.adViewsPer100, next.adClicksPer100]);
  return next;
}
