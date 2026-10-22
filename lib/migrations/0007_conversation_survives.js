// Migration 0007 — a conversation outlives its listing.
//
// Deleting a listing used to delete the conversations about it, which
// took the TENANT's history with it. That was wrong: each side owns its
// own chat history. A landlord deleting their home means the landlord
// leaves the conversation — not that the tenant's messages are erased.
//
// For the thread to survive the listing row being deleted, the
// conversation has to stand on its own:
//   listing_title  what the conversation was about, denormalized, so the
//                  tenant still sees a name once the listing is gone
//   closed_at      when the landlord left (listing deleted). The tenant
//                  can still read; nobody can write.
//
// Reversible: down drops both columns. Nothing is lost by rolling back
// except the "landlord left" marker.
export const version = '0007';
export const name = 'conversation_survives';

export async function up(db) {
  await db.query('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS listing_title TEXT');
  await db.query('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS closed_at BIGINT');
  // Backfill titles for every conversation whose listing is still here,
  // so existing threads keep their name if the home is deleted later.
  await db.query(`UPDATE conversations c SET listing_title = l.title
                  FROM listings l WHERE l.id = c.listing_id AND c.listing_title IS NULL`);
  await db.query('CREATE INDEX IF NOT EXISTS conversations_tenant_idx ON conversations (tenant)');
}

export async function down(db) {
  await db.query('DROP INDEX IF EXISTS conversations_tenant_idx');
  await db.query('ALTER TABLE conversations DROP COLUMN IF EXISTS closed_at');
  await db.query('ALTER TABLE conversations DROP COLUMN IF EXISTS listing_title');
}
