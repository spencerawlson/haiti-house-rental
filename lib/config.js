// Pricing. Landlord fees became a SUBSCRIPTION on 2026-10-23 (Spencer):
// joining costs more than renewing, and the account has a lifecycle
// instead of a single one-time switch.
//
//   join          1500 HTG once, the first time a landlord signs up
//   quarter       1000 HTG every 3 months to stay listed
//   reactivation  1500 HTG — the joining price again, after an account
//                 has been deactivated for non-payment
//
// Lifecycle (lib/billing-server.js, driven by the scheduled job):
//
//   pending ──join paid──▶ active ──quarter unpaid──▶ suspended
//                            ▲                            │
//                            └────quarter paid────────────┘
//                                                         │ 30 days
//                                                         ▼
//                                                    deactivated
//                                                         │
//                                              reactivation paid
//                                                         └──▶ active
//
// Tenants are free and are never billed. Partner accounts (admin-created)
// never pay either: both carry paid_until = NULL, which means "does not
// expire".
//
// Advertising stays 75 HTG/month per home. Same price for everyone, so no
// home is ranked first — the carousel is the visibility, not a search
// boost. Collection is still manual: the admin matches the MonCash/NatCash
// transfer to the phone number on the account.
export const JOIN_FEE_HTG = 1500;
export const QUARTER_FEE_HTG = 1000;
export const REACTIVATION_FEE_HTG = 1500;
export const QUARTER_MONTHS = 3;

// BILLING_QUARTER_MS / BILLING_GRACE_MS override the two periods. They
// exist so the regression tests can use seconds instead of months; leave
// them unset in production, where a quarter is three CALENDAR months (so
// a renewal lands on the same day of the month, not 90 days later).
export function quarterMs() {
  const raw = Number(process.env.BILLING_QUARTER_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

export function graceMs() {
  const raw = Number(process.env.BILLING_GRACE_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : SUSPENSION_GRACE_DAYS * 86400000;
}
// How long a suspended account has to pay before it is deactivated and
// owes the joining price again.
export const SUSPENSION_GRACE_DAYS = 30;

// Kept so the pre-subscription `activation` payments already in the
// ledger still price correctly. Nothing new should charge this.
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
