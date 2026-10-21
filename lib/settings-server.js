// Payment destination numbers — Postgres (since Oct 2026). The
// registration fee is transferred TO these numbers: the Digicel number
// for MonCash, the Natcom number for NatCash. Both are set from the Admin
// Board, never hardcoded.
import { query } from './db';

export async function getSettings() {
  const { rows } = await query('SELECT * FROM settings WHERE id = 1');
  const r = rows[0] || {};
  return { moncashNumber: r.moncash_number || '', natcashNumber: r.natcash_number || '' };
}

export async function setSettings({ moncashNumber, natcashNumber }) {
  const current = await getSettings();
  const next = {
    moncashNumber: typeof moncashNumber === 'string' ? moncashNumber.trim() : current.moncashNumber,
    natcashNumber: typeof natcashNumber === 'string' ? natcashNumber.trim() : current.natcashNumber,
  };
  await query('UPDATE settings SET moncash_number = $1, natcash_number = $2 WHERE id = 1', [next.moncashNumber, next.natcashNumber]);
  return next;
}
