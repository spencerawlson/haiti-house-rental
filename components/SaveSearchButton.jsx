'use client';

import { useState } from 'react';

// Centris-style saved search: stores the current filter URL in the browser.
// The saved-searches page matches new listings against it.
export const SAVED_KEY = 'kay-saved-searches';

export function readSavedSearches() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
  } catch {
    return [];
  }
}

function labelFor(params) {
  const parts = [];
  if (params.get('q')) parts.push(`"${params.get('q')}"`);
  if (params.get('department')) parts.push(params.get('department'));
  if (params.get('type')) parts.push(params.get('type'));
  if (params.get('minBeds')) parts.push(`${params.get('minBeds')}+ chanm`);
  if (params.get('maxPrice')) parts.push(`≤ ${params.get('maxPrice')} HTG`);
  return parts.length ? parts.join(' · ') : 'Tout kay';
}

export default function SaveSearchButton({ savedLabel }) {
  const [saved, setSaved] = useState(false);

  function save() {
    const params = new URLSearchParams(window.location.search);
    params.delete('view');
    params.delete('sort');
    const query = params.toString();
    const searches = readSavedSearches();
    if (searches.some((s) => s.query === query)) {
      setSaved(true);
      return;
    }
    searches.push({ query, label: labelFor(params), createdAt: Date.now() });
    localStorage.setItem(SAVED_KEY, JSON.stringify(searches));
    setSaved(true);
  }

  return (
    <button className="btn btn-secondary" type="button" onClick={save} disabled={saved}>
      {saved ? '✓ ' : '🔔 '}{savedLabel}
    </button>
  );
}
