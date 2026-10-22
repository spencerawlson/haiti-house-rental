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
    // What it was about, kept here so the thread still has a name once
    // the listing is gone. closedAt = the landlord left (home deleted).
    listingTitle: r.listing_title || null,
    closedAt: r.closed_at ? Number(r.closed_at) : null,
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
    `INSERT INTO conversations (id, listing_id, tenant, landlord, listing_title, created_at) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (listing_id, tenant) DO NOTHING`,
    [`conv-${randomBytes(12).toString('hex')}`, listing.id, tenant, listing.owner || null, listing.title || null, Date.now()],
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

// The landlord deleted the home: they leave every conversation about it,
// and the tenant keeps the messages. The title is pinned here first,
// because the listing row is about to go.
//
// This is deliberately NOT a delete. Each side owns its own history: a
// landlord clearing out their library must not reach into a tenant's
// inbox and erase what they wrote.
export async function closeConversationsForListing(listingId, title) {
  const { rowCount } = await query(
    `UPDATE conversations
     SET listing_title = COALESCE(listing_title, $2), closed_at = COALESCE(closed_at, $3)
     WHERE listing_id = $1`,
    [listingId, title || null, Date.now()],
  );
  return rowCount;
}

// Every conversation a tenant is part of, listing row or not. Used by the
// inbox so a thread survives its listing being deleted.
export async function listConversationsForTenant(tenant) {
  const { rows } = await query('SELECT * FROM conversations WHERE tenant = $1', [tenant]);
  return rows.map(mapConversation);
}
