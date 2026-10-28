// Migration 0024 — voice notes in chat.
//
// A message is either text or a voice note (or in principle both, but the
// composer only ever sends one). audio_peaks is a JSON-encoded array of
// 0-1 floats — the clip's amplitude envelope, downsampled to a fixed bar
// count at recording time, the same way accounts.location stores JSON in
// a TEXT column (lib/accounts-server.js parseLocation). Captured once on
// the sender's device instead of decoded server-side or by every viewer,
// since this app targets low-end phones.
//
// Reversible: down drops the three columns.
export const version = '0024';
export const name = 'voice_notes';

export async function up(db) {
  await db.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS audio_url TEXT`);
  await db.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS audio_duration_ms INTEGER`);
  await db.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS audio_peaks TEXT`);
}

export async function down(db) {
  await db.query(`ALTER TABLE chat_messages DROP COLUMN IF EXISTS audio_peaks`);
  await db.query(`ALTER TABLE chat_messages DROP COLUMN IF EXISTS audio_duration_ms`);
  await db.query(`ALTER TABLE chat_messages DROP COLUMN IF EXISTS audio_url`);
}
