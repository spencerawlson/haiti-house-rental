// Payment destination numbers (v0, in-memory — moves to the database with
// everything else). The registration fee is transferred TO these numbers:
// the Digicel number for MonCash, the Natcom number for NatCash. Both are
// set from the Admin Board, never hardcoded.
const settings = {
  moncashNumber: '',
  natcashNumber: '',
};

export function getSettings() {
  return { ...settings };
}

export function setSettings({ moncashNumber, natcashNumber }) {
  if (typeof moncashNumber === 'string') settings.moncashNumber = moncashNumber.trim();
  if (typeof natcashNumber === 'string') settings.natcashNumber = natcashNumber.trim();
  return getSettings();
}
