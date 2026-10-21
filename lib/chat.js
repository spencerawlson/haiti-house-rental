// Chat threads — Postgres (since Oct 2026). One thread per listing, and
// nothing but real messages in it: the old demo greeting ("Bonjou! Èske
// ... toujou disponib?" / "Wi, li disponib...") was fake dialogue shown to
// real users, so it is gone — a thread starts empty until someone writes.
import { query } from './db';

function mapMessage(r) {
  return { id: r.id, sender: r.sender, text: r.text, at: Number(r.at) };
}

export async function getThread(listingId) {
  const { rows } = await query('SELECT * FROM chat_messages WHERE listing_id = $1 ORDER BY at ASC', [listingId]);
  return rows.map(mapMessage);
}

export async function postMessage(listingId, sender, text) {
  const clean = String(text || '').trim();
  if (!clean || !['tenant', 'owner'].includes(sender)) return null;
  const msg = { id: `${listingId}-m${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, sender, text: clean, at: Date.now() };
  await query(
    'INSERT INTO chat_messages (id, listing_id, sender, text, at) VALUES ($1,$2,$3,$4,$5)',
    [msg.id, listingId, sender, msg.text, msg.at],
  );
  return msg;
}
