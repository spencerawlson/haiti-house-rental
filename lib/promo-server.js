// Promo countdown counts (0022): one source for the Admin Board
// route and the landing-page announcement. Count only — no account
// data ever leaves through these numbers, so the landing page may
// render them for anonymous visitors.
import { query } from './db';
import { PROMO_SPOTS } from './config';

export async function getPromoCounts() {
  const { rows } = await query('SELECT COUNT(*)::int AS tagged FROM accounts WHERE promo_tagged');
  const tagged = rows[0]?.tagged ?? 0;
  return { spots: PROMO_SPOTS, tagged, remaining: Math.max(0, PROMO_SPOTS - tagged) };
}
