// Chat threads — Postgres (since Oct 2026). Nothing but real messages:
// the old demo greeting ("Bonjou! Èske ... toujou disponib?" / "Wi, li
// disponib...") was fake dialogue shown to real users, so it is gone — a
// thread starts empty until someone writes.
//
// Threads are private (Oct 2026): a thread is one listing + one tenant,
// so two tenants writing about the same home never see each other's
// messages. The owner sees one thread per tenant. Writing needs a
// signed-in account; the routes take who-is-who from the session.
// Legacy messages from anonymous writers sit in the '' tenant thread,
// visible to the owner only.
//
// Notifications: every user has a per-thread read marker. Unread for the
// owner = tenant messages after their last read; for the tenant = owner
// replies. The Chat tab badge and the inbox read from here.
import { query } from './db';

// audio_peaks is a JSON array (the clip's amplitude envelope); stored as
// TEXT the same way accounts.location stores JSON (lib/accounts-server.js
// parseLocation) — parse defensively, never let a malformed row break the
// thread.
function parsePeaks(v) {
  if (!v) return null;
  try {
    const a = JSON.parse(v);
    return Array.isArray(a) ? a : null;
  } catch {
    return null;
  }
}

function mapMessage(r) {
  return {
    id: r.id,
    sender: r.sender,
    text: r.text,
    at: Number(r.at),
    author: r.author || null,
    audioUrl: r.audio_url || null,
    audioDurationMs: r.audio_duration_ms != null ? Number(r.audio_duration_ms) : null,
    audioPeaks: parsePeaks(r.audio_peaks),
  };
}

export async function getThread(listingId, tenant) {
  const { rows } = await query(
    'SELECT * FROM chat_messages WHERE listing_id = $1 AND tenant = $2 ORDER BY at ASC',
    [listingId, tenant],
  );
  return rows.map(mapMessage);
}

export async function threadExists(listingId, tenant) {
  const { rows } = await query('SELECT 1 FROM chat_messages WHERE listing_id = $1 AND tenant = $2 LIMIT 1', [listingId, tenant]);
  return rows.length > 0;
}

export async function postMessage({ listingId, sender, tenant, text, author, audioUrl, audioDurationMs, audioPeaks, clientId }) {
  const clean = String(text || '').trim().slice(0, 2000);
  // A message is text, a voice note, or both — never neither.
  if ((!clean && !audioUrl) || !['tenant', 'owner'].includes(sender) || typeof tenant !== 'string') return null;
  // Optional idempotency key from the sender's device (migration 0025): a
  // resend with the same key — a retry after a lost reply, e.g. the offline
  // outbox — must not create a second message. Trusted only as a short,
  // plain string; anything else behaves as if no key was sent.
  const cid = typeof clientId === 'string' && clientId.length > 0 && clientId.length <= 64 ? clientId : null;
  const msg = {
    id: `${listingId}-m${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sender,
    text: clean,
    at: Date.now(),
    author: author || null,
    audioUrl: audioUrl || null,
    audioDurationMs: audioDurationMs != null ? audioDurationMs : null,
    audioPeaks: audioPeaks || null,
  };
  const { rows } = await query(
    `INSERT INTO chat_messages (id, listing_id, sender, text, at, author, tenant, audio_url, audio_duration_ms, audio_peaks, client_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (listing_id, tenant, client_id) WHERE client_id IS NOT NULL DO NOTHING
     RETURNING id`,
    [msg.id, listingId, sender, msg.text, msg.at, msg.author, tenant, msg.audioUrl, msg.audioDurationMs, msg.audioPeaks ? JSON.stringify(msg.audioPeaks) : null, cid],
  );
  // No row back means this key was already used: return the message the
  // first send created, so the retry is a no-op that still "succeeds"
  // rather than erroring or duplicating.
  if (rows.length === 0) {
    const { rows: existing } = await query(
      'SELECT * FROM chat_messages WHERE listing_id = $1 AND tenant = $2 AND client_id = $3',
      [listingId, tenant, cid],
    );
    return existing[0] ? mapMessage(existing[0]) : null;
  }
  return msg;
}

export async function markThreadRead(listingId, username, tenant) {
  if (!listingId || !username) return;
  await query(
    `INSERT INTO chat_reads (listing_id, username, tenant, last_read_at) VALUES ($1,$2,$3,$4)
     ON CONFLICT (listing_id, username, tenant) DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
    [listingId, username, tenant, Date.now()],
  );
}

// Delete a chat on one side only: the thread leaves this user's inbox
// (and unread counts) but stays for the other side. A message from
// either side after the hide brings it back — hiding is not erasing.
export async function hideThread(listingId, username, tenant) {
  if (!listingId || !username) return;
  await query(
    `INSERT INTO chat_hidden (listing_id, username, tenant, hidden_at) VALUES ($1,$2,$3,$4)
     ON CONFLICT (listing_id, username, tenant) DO UPDATE SET hidden_at = EXCLUDED.hidden_at`,
    [listingId, username, tenant, Date.now()],
  );
}

async function otherInfo(username) {
  if (!username) return { name: null, avatarUrl: null };
  const { rows } = await query('SELECT name, avatar_url FROM accounts WHERE username = $1', [username]);
  return { name: (rows[0]?.name || '').trim().split(/\s+/)[0] || null, avatarUrl: rows[0]?.avatar_url || null };
}

// Threads the user is part of.
//
// Owner side: one per tenant on each ACTIVE listing they own. A landlord
// who takes a home down or deletes it drops out of those threads — for a
// deletion that is the whole point, they left the conversation.
//
// Tenant side: every thread they wrote in, listing row or not. A tenant's
// history is theirs: the landlord deleting the home must not empty the
// tenant's inbox. Threads whose listing is gone (or no longer active)
// come back marked `closed` — readable, not writable — and take their
// name from conversations.listing_title, pinned there before the listing
// row went.
export async function getInbox(username) {
  if (!username) return [];
  const { rows: owned } = await query(
    `SELECT DISTINCT m.listing_id, m.tenant FROM chat_messages m
     JOIN listings l ON l.id = m.listing_id
     WHERE l.owner = $1 AND l.status = 'active'`,
    [username],
  );
  const { rows: mine } = await query(
    `SELECT DISTINCT m.listing_id, m.tenant FROM chat_messages m
     LEFT JOIN listings l ON l.id = m.listing_id
     WHERE m.tenant = $1 AND (l.id IS NULL OR l.owner IS NULL OR l.owner <> $1)`,
    [username],
  );
  const keys = [...owned.map((r) => ({ ...r, isOwner: true })), ...mine.map((r) => ({ ...r, isOwner: false }))];
  if (keys.length === 0) return [];
  const ids = [...new Set(keys.map((k) => k.listing_id))];
  const { rows: listings } = await query('SELECT id, title, owner, status FROM listings WHERE id = ANY($1)', [ids]);
  const byId = new Map(listings.map((r) => [r.id, r]));
  // Standby identity for threads whose listing is gone.
  const { rows: convs } = await query(
    'SELECT listing_id, tenant, landlord, listing_title, closed_at FROM conversations WHERE listing_id = ANY($1)',
    [ids],
  );
  const convMap = new Map(convs.map((r) => [`${r.listing_id}|${r.tenant}`, r]));
  const { rows: reads } = await query('SELECT listing_id, tenant, last_read_at FROM chat_reads WHERE username = $1', [username]);
  const readMap = new Map(reads.map((r) => [`${r.listing_id}|${r.tenant}`, Number(r.last_read_at)]));
  const { rows: hidden } = await query('SELECT listing_id, tenant, hidden_at FROM chat_hidden WHERE username = $1', [username]);
  const hiddenMap = new Map(hidden.map((r) => [`${r.listing_id}|${r.tenant}`, Number(r.hidden_at)]));
  const threads = [];
  for (const k of keys) {
    const key = `${k.listing_id}|${k.tenant}`;
    const listing = byId.get(k.listing_id) || null;
    const conv = convMap.get(key) || null;
    // No listing and no conversation to stand in for it: nothing to show.
    if (!listing && !conv) continue;
    // Closed = the landlord is out of it. Either the home was deleted
    // (no row at all) or it is no longer active.
    const closed = !listing || listing.status !== 'active';
    const { rows: msgs } = await query(
      'SELECT sender, text, at, audio_url FROM chat_messages WHERE listing_id = $1 AND tenant = $2 ORDER BY at ASC',
      [k.listing_id, k.tenant],
    );
    if (msgs.length === 0) continue;
    const last = msgs[msgs.length - 1];
    // Hidden on this side and nothing new since: stays out of the inbox.
    if (Number(last.at) <= (hiddenMap.get(key) || 0)) continue;
    const lastRead = readMap.get(key) || 0;
    const unread = msgs.filter(
      (m) => Number(m.at) > lastRead && (k.isOwner ? m.sender === 'tenant' : m.sender === 'owner'),
    ).length;
    // The other person, first name only: the tenant for the owner, the
    // owner for the tenant. Anonymous legacy writers have no name.
    const otherUsername = k.isOwner ? k.tenant || null : listing?.owner || conv?.landlord || null;
    const other = await otherInfo(otherUsername);
    threads.push({
      key,
      listingId: k.listing_id,
      tenant: k.tenant,
      isOwner: k.isOwner,
      listingTitle: listing?.title || conv?.listing_title || null,
      otherName: other.name,
      otherAvatarUrl: other.avatarUrl,
      otherUsername,
      lastText: last.text,
      lastIsVoice: !!last.audio_url,
      lastSender: last.sender,
      lastAt: Number(last.at),
      unread,
      // The tenant's inbox shows this under the last message instead of
      // a reply box: the landlord is out of the conversation.
      closed,
      landlordLeft: !listing,
    });
  }
  threads.sort((a, b) => b.lastAt - a.lastAt);
  return threads;
}

export async function getUnreadTotal(username) {
  const threads = await getInbox(username);
  return threads.reduce((sum, t) => sum + t.unread, 0);
}
