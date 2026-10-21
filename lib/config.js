// Pricing, decided by Spencer 2026-10-21:
// - Account activation (one-time, via MonCash/NatCash): 1000 HTG.
// - Featured placement (house shown first, rent or sale): 75 HTG/month.
// Payment collection itself is NOT built yet — these are decided prices,
// not live charges. Activation enforcement arrives with landlord accounts.
export const ACTIVATION_FEE_HTG = 500;
export const FEATURED_FEE_HTG_MONTH = 75;
export const PAYMENT_PROVIDERS = ['moncash', 'natcash'];
export const LOCALES = ['ht', 'fr', 'en'];
export const DEFAULT_LOCALE = 'ht';
