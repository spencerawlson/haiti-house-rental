'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';

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

// `query` is the canonical search (view and sort already stripped), handed
// down by the page so the button and the stored entry always agree.
export default function SaveSearchButton({ savedLabel, query = '', alertsHref = null, savedText = null, failedText = null }) {
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);

  // Show what is already stored, the way the favourite heart does. Without
  // this the button read "save this search" even for a search that was
  // already saved, so saving looked like it had done nothing — and the
  // second press was swallowed by the de-duplication below.
  useEffect(() => {
    setSaved(readSavedSearches().some((s) => s.query === query));
    setFailed(false);
  }, [query]);

  function save() {
    const searches = readSavedSearches();
    if (searches.some((s) => s.query === query)) {
      setSaved(true);
      return;
    }
    const next = [...searches, { query, label: labelFor(new URLSearchParams(query)), createdAt: Date.now() }];
    // A browser that refuses to write — private mode, a locked-down
    // WebView — used to throw here and leave the button untouched, with
    // nothing said. Say it instead.
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      setFailed(true);
      return;
    }
    setSaved(true);
  }

  if (failed) {
    return <span className="muted" role="status">{failedText || savedLabel}</span>;
  }

  // Once saved, the button becomes the way to the alerts page: saving
  // used to leave no trace and nowhere to go.
  if (saved) {
    const text = `✓ ${savedText || savedLabel}`;
    return alertsHref
      ? <Link className="btn btn-secondary" href={alertsHref}>{text}</Link>
      : <span className="btn btn-secondary">{text}</span>;
  }

  return (
    <button className="btn btn-secondary" type="button" onClick={save}>
      <Icon name="bell" /> {savedLabel}
    </button>
  );
}
