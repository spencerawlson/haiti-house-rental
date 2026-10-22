// Pricing, decided by Spencer 2026-10-21:
// - Account activation (one-time, via MonCash/NatCash): 1000 HTG.
// - Advertising (home appears in the advertised carousel on the home page,
//   rent or sale): 75 HTG/month. Same price for everyone, so no home is
//   ranked first — the carousel is the visibility, not a search boost.
// Payment collection itself is manual: the admin matches the transfer to
// the phone number on the account and activates it.
export const ACTIVATION_FEE_HTG = 1000;
export const ADVERTISED_FEE_HTG_MONTH = 75;
export const PAYMENT_PROVIDERS = ['moncash', 'natcash'];
export const LOCALES = ['ht', 'fr', 'en'];
export const DEFAULT_LOCALE = 'ht';

// Sold / leased (Phase 9). A landlord marks a home sold or leased when
// the deal is done. The listing leaves search immediately — a tenant
// should never spend mobile data opening a home that is gone — and is
// deleted for good 48 hours later, which doubles as the undo window:
// until then "put back online" brings it back.
//
// SOLD_DELETE_AFTER_MS overrides the delay. It exists so the regression
// tests can use a couple of seconds instead of two days; leave it unset
// in production.
export const SOLD_STATUSES = ['sold', 'leased'];
const SOLD_DELETE_AFTER_DEFAULT_MS = 48 * 60 * 60 * 1000;

export function soldDeleteAfterMs() {
  const raw = Number(process.env.SOLD_DELETE_AFTER_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : SOLD_DELETE_AFTER_DEFAULT_MS;
}
