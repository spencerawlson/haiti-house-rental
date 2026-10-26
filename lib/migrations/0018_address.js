// Migration 0018 — a free-text address on each listing.
//
// Some landlords live abroad, so "use my location" cannot place their
// home: they type the property's address instead, and the pin comes from
// geocoding that address (with the manual pin still available as a
// fallback — Haitian addresses are often informal and may not geocode).
// The address is optional and shown on the detail page.
//
// Reversible: down drops the column.
export const version = '0018';
export const name = 'address';

export async function up(db) {
  await db.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT ''`);
}

export async function down(db) {
  await db.query('ALTER TABLE listings DROP COLUMN IF EXISTS address');
}
