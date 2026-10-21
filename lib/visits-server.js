// Visit appointments (v0, in-memory — moves to the database with everything
// else). A tenant proposes a date + time to see a home; the listing owner
// confirms or declines. The same appointment is visible to both sides: on
// the listing page and in each party's Account → My visits.
import { getListing } from '@/lib/listings';

const visits = [];

export function createVisit({ listingId, tenant, date, time, message }) {
  const listing = getListing(listingId);
  if (!listing) return null;
  const visit = {
    id: `visit-${Date.now()}`,
    listingId,
    listingTitle: listing.title,
    owner: listing.owner || null,
    tenant,
    date,
    time,
    message: message || '',
    status: 'proposed',
    createdAt: Date.now(),
  };
  visits.push(visit);
  return visit;
}

export function listVisitsForListing(listingId) {
  return visits.filter((v) => v.listingId === listingId);
}

// Visits where the user is the tenant, or the owner of the listing.
export function listVisitsForUser(username) {
  return visits.filter((v) => v.tenant === username || v.owner === username);
}

export function setVisitStatus(id, status, username) {
  const visit = visits.find((v) => v.id === id);
  // Only the listing owner can confirm or decline.
  if (!visit || visit.owner !== username) return null;
  if (status !== 'confirmed' && status !== 'declined') return null;
  visit.status = status;
  return visit;
}
