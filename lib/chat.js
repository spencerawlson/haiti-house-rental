// Chat threads, v0: one thread per listing, kept in server memory.
// Honest limits: messages reset when the server restarts, and per-tenant
// threads + landlord accounts come later (see SPEC.md). Production needs a
// database (Postgres) and authentication before this holds real discussions.
import { LISTINGS } from './listings';

const threads = new Map();

function seed(listing) {
  return [
    { id: `${listing.id}-m1`, sender: 'tenant', text: `Bonjou! Èske ${listing.title} toujou disponib?`, at: Date.now() - 3600_000 },
    { id: `${listing.id}-m2`, sender: 'owner', text: 'Wi, li disponib. Ou ka vin vizite l semèn sa a.', at: Date.now() - 1800_000 },
  ];
}

export function getThread(listingId) {
  if (!threads.has(listingId)) {
    const listing = LISTINGS.find((l) => l.id === listingId);
    threads.set(listingId, listing ? seed(listing) : []);
  }
  return threads.get(listingId);
}

export function postMessage(listingId, sender, text) {
  const clean = String(text || '').trim();
  if (!clean || !['tenant', 'owner'].includes(sender)) return null;
  const msg = { id: `${listingId}-m${Date.now()}`, sender, text: clean, at: Date.now() };
  getThread(listingId).push(msg);
  return msg;
}
