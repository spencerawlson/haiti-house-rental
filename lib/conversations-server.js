// Conversations (Phase 2): the stable identity of a private thread — one
// listing, one landlord, one tenant. Messages are stored by
// (listing_id, tenant); this table adds the id, block state and the
// landlord at the time the thread started.
import { randomBytes } from 'crypto';
import { query } from './db';

function mapConversation(r) {
  if (!r) return null;
  return {
    id: r.id,
    listingId: r.listing_id,
    tenant: r.tenant,
    landlord: r.landlord,
    blockedBy: r.blocked_by || null,
    blockedAt: r.blocked_at ? Number(r.blocked_at) : null,
    createdAt: Number(r.created_at),
  };
}

export async function getConversation(listingId, tenant) {
  const { rows } = await query('SELECT * FROM conversations WHERE listing_id = $1 AND tenant = $2', [listingId, tenant]);
  return mapConversation(rows[0]);
}

export async function getConversationById(id) {
  const { rows } = await query('SELECT * FROM conversations WHERE id = $1', [id]);
  return mapConversation(rows[0]);
}

export async function ensureConversation(listing, tenant) {
  const existing = await getConversation(listing.id, tenant);
  if (existing) return existing;
  await query(
    `INSERT INTO conversations (id, listing_id, tenant, landlord, created_at) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (listing_id, tenant) DO NOTHING`,
    [`conv-${randomBytes(12).toString('hex')}`, listing.id, tenant, listing.owner || null, Date.now()],
  );
  return getConversation(listing.id, tenant);
}

// Block: either participant stops the thread. Only the person who
// blocked can unblock. Messages stay (they may be evidence in a report).
export async function setBlocked(conversationId, username, blocked) {
  const conv = await getConversationById(conversationId);
  if (!conv) return null;
  if (blocked && !conv.blockedBy) {
    await query('UPDATE conversations SET blocked_by = $2, blocked_at = $3 WHERE id = $1', [conversationId, username, Date.now()]);
  } else if (!blocked && conv.blockedBy === username) {
    await query('UPDATE conversations SET blocked_by = NULL, blocked_at = NULL WHERE id = $1', [conversationId]);
  }
  return getConversationById(conversationId);
}

export async function getMessagesByConversation(conv) {
  const { rows } = await query(
    'SELECT id, sender, text, at, author FROM chat_messages WHERE listing_id = $1 AND tenant = $2 ORDER BY at ASC',
    [conv.listingId, conv.tenant],
  );
  return rows.map((r) => ({ id: r.id, sender: r.sender, text: r.text, at: Number(r.at), author: r.author || null }));
}
