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

function mapMessage(r) {
  return { id: r.id, sender: r.sender, text: r.text, at: Number(r.at), author: r.author || null };
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

export async function postMessage({ listingId, sender, tenant, text, author }) {
  const clean = String(text || '').trim().slice(0, 2000);
  if (!clean || !['tenant', 'owner'].includes(sender) || typeof tenant !== 'string') return null;
  const msg = { id: `${listingId}-m${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, sender, text: clean, at: Date.now(), author: author || null };
  await query(
    'INSERT INTO chat_messages (id, listing_id, sender, text, at, author, tenant) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [msg.id, listingId, sender, msg.text, msg.at, msg.author, tenant],
  );
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

async function firstName(username) {
  if (!username) return null;
  const { rows } = await query('SELECT name FROM accounts WHERE username = $1', [username]);
  return (rows[0]?.name || '').trim().split(/\s+/)[0] || null;
}

// Threads the user is part of: one per tenant on each active listing they
// own, plus their own thread on each listing they wrote about. Removed
// listings are excluded — their detail pages are gone.
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
     JOIN listings l ON l.id = m.listing_id
     WHERE m.tenant = $1 AND l.status = 'active' AND (l.owner IS NULL OR l.owner <> $1)`,
    [username],
  );
  const keys = [...owned.map((r) => ({ ...r, isOwner: true })), ...mine.map((r) => ({ ...r, isOwner: false }))];
  if (keys.length === 0) return [];
  const { rows: listings } = await query('SELECT id, title, owner FROM listings WHERE id = ANY($1)', [[...new Set(keys.map((k) => k.listing_id))]]);
  const byId = new Map(listings.map((r) => [r.id, r]));
  const { rows: reads } = await query('SELECT listing_id, tenant, last_read_at FROM chat_reads WHERE username = $1', [username]);
  const readMap = new Map(reads.map((r) => [`${r.listing_id}|${r.tenant}`, Number(r.last_read_at)]));
  const { rows: hidden } = await query('SELECT listing_id, tenant, hidden_at FROM chat_hidden WHERE username = $1', [username]);
  const hiddenMap = new Map(hidden.map((r) => [`${r.listing_id}|${r.tenant}`, Number(r.hidden_at)]));
  const threads = [];
  for (const k of keys) {
    const listing = byId.get(k.listing_id);
    if (!listing) continue;
    const key = `${k.listing_id}|${k.tenant}`;
    const { rows: msgs } = await query(
      'SELECT sender, text, at FROM chat_messages WHERE listing_id = $1 AND tenant = $2 ORDER BY at ASC',
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
    const otherUsername = k.isOwner ? k.tenant || null : listing.owner;
    threads.push({
      key,
      listingId: k.listing_id,
      tenant: k.tenant,
      isOwner: k.isOwner,
      listingTitle: listing.title,
      otherName: await firstName(otherUsername),
      otherUsername,
      lastText: last.text,
      lastSender: last.sender,
      lastAt: Number(last.at),
      unread,
    });
  }
  threads.sort((a, b) => b.lastAt - a.lastAt);
  return threads;
}

export async function getUnreadTotal(username) {
  const threads = await getInbox(username);
  return threads.reduce((sum, t) => sum + t.unread, 0);
}
