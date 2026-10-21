// Visit appointments — Postgres (since Oct 2026). A tenant proposes a
// date + time to see a home; the listing owner confirms or declines. The
// same appointment is visible to both sides: on the listing page and in
// each party's Account → My visits.
import { query } from './db';
import { getListing } from './listings-server';

function mapVisit(r) {
  return {
    id: r.id,
    listingId: r.listing_id,
    listingTitle: r.listing_title,
    owner: r.owner,
    tenant: r.tenant,
    date: r.date,
    time: r.time,
    message: r.message,
    status: r.status,
    createdAt: Number(r.created_at),
  };
}

export async function createVisit({ listingId, tenant, date, time, message }) {
  const listing = await getListing(listingId);
  if (!listing) return null;
  const visit = {
    id: `visit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
  const { rows } = await query(
    `INSERT INTO visits (id, listing_id, listing_title, owner, tenant, date, time, message, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [visit.id, visit.listingId, visit.listingTitle, visit.owner, visit.tenant, visit.date, visit.time, visit.message, visit.status, visit.createdAt],
  );
  return mapVisit(rows[0]);
}

export async function listVisitsForListing(listingId) {
  const { rows } = await query('SELECT * FROM visits WHERE listing_id = $1 ORDER BY created_at ASC', [listingId]);
  return rows.map(mapVisit);
}

// Visits where the user is the tenant, or the owner of the listing.
export async function listVisitsForUser(username) {
  const { rows } = await query(
    'SELECT * FROM visits WHERE tenant = $1 OR owner = $1 ORDER BY created_at ASC',
    [username],
  );
  return rows.map(mapVisit);
}

export async function setVisitStatus(id, status, username) {
  const { rows } = await query('SELECT * FROM visits WHERE id = $1', [id]);
  const visit = rows[0];
  // Only the listing owner can confirm or decline.
  if (!visit || visit.owner !== username) return null;
  if (status !== 'confirmed' && status !== 'declined') return null;
  const updated = await query('UPDATE visits SET status = $2 WHERE id = $1 RETURNING *', [id, status]);
  return mapVisit(updated.rows[0]);
}
