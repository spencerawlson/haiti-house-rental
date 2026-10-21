import { ACTIVATION_FEE_HTG } from '@/lib/config';

// Activation revenue ledger (v0, in-memory — resets on server restart,
// like the other stores; a database comes later).
// One entry per landlord account: 500 HTG when the admin activates it.
// Tenant accounts are free and never appear here. Deactivate + re-activate
// does NOT double-count: the first activation is the one that paid.
const entries = [];

export function logActivation(account) {
  if (!account || account.role === 'tenant') return null;
  if (entries.some((e) => e.username === account.username)) return null;
  const entry = {
    username: account.username,
    name: account.name,
    amountHTG: ACTIVATION_FEE_HTG,
    activatedAt: Date.now(),
  };
  entries.push(entry);
  return entry;
}

export function getRevenue() {
  return {
    entries: [...entries],
    totalHTG: entries.reduce((sum, e) => sum + e.amountHTG, 0),
  };
}
