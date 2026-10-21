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
