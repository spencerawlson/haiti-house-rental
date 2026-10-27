// Admin chat threads — Postgres. Same shape as the landlord↔tenant
// chat (a thread, messages in order, per-side read markers, an unread
// count for the side that has not read yet) but NOT listing-bound:
// there is no home in a "Contact admin" conversation, so these threads
// live in their own tables instead of conversations/chat_messages.
//
// Read marking rides two columns on the thread: the user side's unread
// is admin messages after user_last_read_at, the admin side's unread
// is user messages after admin_last_read_at. Opening a thread marks
// that side read, exactly like the listing chat's read route.
//
// A thread row with no messages yet (a user opened Contact admin but
// has not written) never appears in the admin list: the list only
// carries threads with a last message.
import { query } from './db';

function mapMessage(r) {
  return { id: r.id, sender: r.sender, text: r.text, at: Number(r.created_at) };
}

export async function ensureAdminThread(username) {
  await query(
    `INSERT INTO admin_threads (username, created_at) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING`,
    [username, Date.now()],
  );
}

export async function getAdminThread(username) {
  const { rows } = await query(
    'SELECT * FROM admin_messages WHERE username = $1 ORDER BY created_at ASC',
    [username],
  );
  return rows.map(mapMessage);
}

export async function postAdminMessage({ username, sender, text }) {
  const clean = String(text || '').trim().slice(0, 2000);
  if (!clean || !['user', 'admin'].includes(sender)) return null;
  await ensureAdminThread(username);
  const msg = {
    id: `admin-m${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sender,
    text: clean,
    at: Date.now(),
  };
  await query(
    'INSERT INTO admin_messages (id, username, sender, text, created_at) VALUES ($1, $2, $3, $4, $5)',
    [msg.id, username, sender, msg.text, msg.at],
  );
  await query('UPDATE admin_threads SET last_message_at = $2 WHERE username = $1', [username, msg.at]);
  return msg;
}

export async function markAdminThreadRead(username, side) {
  const col = side === 'admin' ? 'admin_last_read_at' : 'user_last_read_at';
  await query(`UPDATE admin_threads SET ${col} = $2 WHERE username = $1`, [username, Date.now()]);
}

// Threads with at least one message, newest first, with the admin's
// unread count per thread (user messages since the admin last read).
export async function listAdminThreads() {
  const { rows } = await query(
    `SELECT t.username, t.last_message_at,
       (SELECT m.text FROM admin_messages m WHERE m.username = t.username ORDER BY m.created_at DESC LIMIT 1) AS last_text,
       (SELECT m.sender FROM admin_messages m WHERE m.username = t.username ORDER BY m.created_at DESC LIMIT 1) AS last_sender,
       (SELECT COUNT(*)::bigint FROM admin_messages m
         WHERE m.username = t.username AND m.sender = 'user'
           AND m.created_at > COALESCE(t.admin_last_read_at, 0)) AS unread
     FROM admin_threads t WHERE t.last_message_at IS NOT NULL ORDER BY t.last_message_at DESC`,
  );
  const names = new Map();
  if (rows.length) {
    const { rows: accs } = await query('SELECT username, name FROM accounts WHERE username = ANY($1)', [rows.map((r) => r.username)]);
    for (const a of accs) names.set(a.username, a.name);
  }
  return rows.map((r) => ({
    username: r.username,
    name: names.get(r.username) || null,
    lastText: r.last_text,
    lastSender: r.last_sender,
    lastAt: Number(r.last_message_at),
    unread: Number(r.unread),
  }));
}

// The user's unread count for admin chat: admin messages since the
// user last read. Read-only by design — the unread endpoint uses this
// without marking anything read, unlike the thread GET route.
export async function getAdminUnread(username) {
  const { rows } = await query(
    `SELECT COUNT(*)::bigint AS c FROM admin_messages m
       JOIN admin_threads t ON t.username = m.username
     WHERE m.username = $1 AND m.sender = 'admin'
       AND m.created_at > COALESCE(t.user_last_read_at, 0)`,
    [username],
  );
  return Number(rows[0]?.c || 0);
}
