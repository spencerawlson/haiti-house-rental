// Migration 0027 — free forever (Nov 2026).
//
// Kay Ayiti drops all fees: no joining fee, no quarterly fee, no
// reactivation fee, and no promo caps. Every account is free,
// activated immediately, and never expires (paid_until = NULL).
//
// - Non-partner landlords: activated, billing_status 'active',
//   paid_until / suspended_at / promo_until all cleared.
// - Non-partner sellers: the same billing cleanup, but activated is
//   set FALSE, not TRUE — any pre-existing public seller is hidden
//   from the Shop (their furniture items leave search with them).
//   The founder's seller account is partner = TRUE and is unaffected.
// - Partner accounts (admin-created) are untouched by every UPDATE.
//
// Reversible in shape only: down is a no-op, because the paid_until /
// promo_until values this migration clears cannot be faithfully
// restored — the old expiry dates are gone once overwritten.
export const version = '0027';
export const name = 'free_forever';

export async function up(db) {
  await db.query(
    `UPDATE accounts SET billing_status = 'active', activated = TRUE, paid_until = NULL, suspended_at = NULL, promo_until = NULL
     WHERE role = 'landlord' AND partner = FALSE`,
  );
  await db.query(
    `UPDATE accounts SET billing_status = 'active', paid_until = NULL, suspended_at = NULL, promo_until = NULL
     WHERE role = 'seller' AND partner = FALSE`,
  );
  await db.query(
    `UPDATE accounts SET activated = FALSE
     WHERE role = 'seller' AND partner = FALSE`,
  );
}

export async function down(db) {
  // No-op: the paid_until / promo_until values cleared by up() cannot
  // be faithfully restored, so there is nothing safe to roll back to.
}
