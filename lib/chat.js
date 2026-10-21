// Chat threads — Postgres (since Oct 2026; the old in-memory store reset
// on every restart). One thread per listing. The first read of a real
// listing's thread seeds the same two demo messages as before, so the chat
// still opens with something — stored this time, so they survive restarts.
import { query } from './db';
import { getListing } from './listings-server';

function mapMessage(r) {
  return { id: r.id, sender: r.sender, text: r.text, at: Number(r.at) };
}

export async function getThread(listingId) {
  const { rows } = await query('SELECT * FROM chat_messages WHERE listing_id = $1 ORDER BY at ASC', [listingId]);
  if (rows.length > 0) return rows.map(mapMessage);
  const listing = await getListing(listingId);
  if (!listing) return [];
  const now = Date.now();
  const seed = [
    { id: `${listingId}-m1`, sender: 'tenant', text: `Bonjou! Èske ${listing.title} toujou disponib?`, at: now - 3600_000 },
    { id: `${listingId}-m2`, sender: 'owner', text: 'Wi, li disponib. Ou ka vin vizite l semèn sa a.', at: now - 1800_000 },
  ];
  for (const m of seed) {
    await query(
      'INSERT INTO chat_messages (id, listing_id, sender, text, at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
      [m.id, listingId, m.sender, m.text, m.at],
    );
  }
  return seed;
}

export async function postMessage(listingId, sender, text) {
  const clean = String(text || '').trim();
  if (!clean || !['tenant', 'owner'].includes(sender)) return null;
  // Seed the thread first, exactly as a read would — so the demo greeting
  // is always there whether the first touch is a read or a write.
  await getThread(listingId);
  const msg = { id: `${listingId}-m${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, sender, text: clean, at: Date.now() };
  await query(
    'INSERT INTO chat_messages (id, listing_id, sender, text, at) VALUES ($1,$2,$3,$4,$5)',
    [msg.id, listingId, sender, msg.text, msg.at],
  );
  return msg;
}
