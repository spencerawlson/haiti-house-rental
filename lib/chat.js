// Chat threads — Postgres (since Oct 2026). One thread per listing, and
// nothing but real messages in it: the old demo greeting ("Bonjou! Èske
// ... toujou disponib?" / "Wi, li disponib...") was fake dialogue shown to
// real users, so it is gone — a thread starts empty until someone writes.
//
// Notifications: every message records its author (username when signed
// in), and every user has a per-thread read marker. A landlord's unread
// messages are the tenant messages in their listings' threads after their
// last read; a tenant's unread are the owner replies in threads they
// wrote in. The Account tab badge and the Account → Messages inbox read
// from here.
import { query } from './db';

function mapMessage(r) {
  return { id: r.id, sender: r.sender, text: r.text, at: Number(r.at), author: r.author || null };
}

export async function getThread(listingId) {
  const { rows } = await query('SELECT * FROM chat_messages WHERE listing_id = $1 ORDER BY at ASC', [listingId]);
  return rows.map(mapMessage);
}

export async function postMessage(listingId, sender, text, author) {
  const clean = String(text || '').trim();
  if (!clean || !['tenant', 'owner'].includes(sender)) return null;
  const msg = { id: `${listingId}-m${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, sender, text: clean, at: Date.now(), author: author || null };
  await query(
    'INSERT INTO chat_messages (id, listing_id, sender, text, at, author) VALUES ($1,$2,$3,$4,$5,$6)',
    [msg.id, listingId, sender, msg.text, msg.at, msg.author],
  );
  return msg;
}

export async function markThreadRead(listingId, username) {
  if (!listingId || !username) return;
  await query(
    `INSERT INTO chat_reads (listing_id, username, last_read_at) VALUES ($1,$2,$3)
     ON CONFLICT (listing_id, username) DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
    [listingId, username, Date.now()],
  );
}

// Delete a chat on one side only: the thread leaves this user's inbox
// (and unread counts) but stays for the other side. A message from
// either side after the hide brings it back — hiding is not erasing.
export async function hideThread(listingId, username) {
  if (!listingId || !username) return;
  await query(
    `INSERT INTO chat_hidden (listing_id, username, hidden_at) VALUES ($1,$2,$3)
     ON CONFLICT (listing_id, username) DO UPDATE SET hidden_at = EXCLUDED.hidden_at`,
    [listingId, username, Date.now()],
  );
}

// Threads the user is part of: listings they own that have tenant
// messages, plus threads they wrote in. Removed listings are excluded —
// their detail pages are gone, so the thread is unreachable.
export async function getInbox(username) {
  if (!username) return [];
  const { rows: owned } = await query(
    `SELECT id, title FROM listings WHERE owner = $1 AND status = 'active'`,
    [username],
  );
  const { rows: authored } = await query(
    'SELECT DISTINCT listing_id FROM chat_messages WHERE author = $1',
    [username],
  );
  const ids = [...new Set([...owned.map((r) => r.id), ...authored.map((r) => r.listing_id)])];
  if (ids.length === 0) return [];
  const { rows: listings } = await query(
    `SELECT id, title, owner, status FROM listings WHERE id = ANY($1)`,
    [ids],
  );
  const byId = new Map(listings.map((r) => [r.id, r]));
  const { rows: reads } = await query(
    'SELECT listing_id, last_read_at FROM chat_reads WHERE username = $1',
    [username],
  );
  const readMap = new Map(reads.map((r) => [r.listing_id, Number(r.last_read_at)]));
  const { rows: hidden } = await query(
    'SELECT listing_id, hidden_at FROM chat_hidden WHERE username = $1',
    [username],
  );
  const hiddenMap = new Map(hidden.map((r) => [r.listing_id, Number(r.hidden_at)]));
  const threads = [];
  for (const id of ids) {
    const listing = byId.get(id);
    if (!listing || listing.status !== 'active') continue;
    const { rows: msgs } = await query(
      'SELECT * FROM chat_messages WHERE listing_id = $1 ORDER BY at ASC',
      [id],
    );
    if (msgs.length === 0) continue;
    const last = msgs[msgs.length - 1];
    // Hidden on this side and nothing new since: stays out of the inbox.
    if (Number(last.at) <= (hiddenMap.get(id) || 0)) continue;
    const isOwner = listing.owner === username;
    const lastRead = readMap.get(id) || 0;
    const unread = msgs.filter(
      (m) => Number(m.at) > lastRead && (isOwner ? m.sender === 'tenant' : m.sender === 'owner'),
    ).length;
    threads.push({
      listingId: id,
      listingTitle: listing.title,
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
