// Promo countdown counts (0022): one source for the Admin Board
// route and the landing-page announcement. Count only — no account
// data ever leaves through these numbers, so the landing page may
// render them for anonymous visitors.
//
// Nov 2026: TWO separate pools. Landlords count toward PROMO_SPOTS
// (now 1000); furniture sellers count toward SELLER_PROMO_SPOTS
// (2000). Both count promo_tagged, but each filters by its own role,
// so a seller tag never consumes a landlord spot and vice versa.
// The landlord fields (spots/tagged/remaining) keep their old shape
// for existing callers; seller fields ride alongside.
import { query } from './db';
import { PROMO_SPOTS, SELLER_PROMO_SPOTS } from './config';

export async function getPromoCounts() {
  const { rows } = await query(
    `SELECT role, COUNT(*)::int AS tagged FROM accounts WHERE promo_tagged GROUP BY role`,
  );
  const byRole = Object.fromEntries(rows.map((r) => [r.role, r.tagged]));
  const tagged = byRole.landlord ?? 0;
  const sellerTagged = byRole.seller ?? 0;
  return {
    spots: PROMO_SPOTS,
    tagged,
    remaining: Math.max(0, PROMO_SPOTS - tagged),
    sellerSpots: SELLER_PROMO_SPOTS,
    sellerTagged,
    sellerRemaining: Math.max(0, SELLER_PROMO_SPOTS - sellerTagged),
  };
}
