'use client';

import { useEffect } from 'react';
import { syncSessionHint } from '@/lib/account';

const VISITOR_KEY = 'kay-visitor';

// Heartbeat: while any Kay Ayiti page is open, ping once a minute so the
// Admin Board can show who is live. Signed-in users count by their
// session cookie; everyone else by an anonymous id kept in localStorage.
// The reply also keeps the local "signed in" hint honest (e.g. a session
// that expired, or one from before server sessions existed).
export default function PresencePing() {
  useEffect(() => {
    let visitor = null;
    try {
      visitor = localStorage.getItem(VISITOR_KEY);
      if (!visitor) {
        visitor = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem(VISITOR_KEY, visitor);
      }
    } catch {}
    async function ping() {
      try {
        const res = await fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitor }),
        });
        if (res.ok) syncSessionHint((await res.json()).username);
      } catch {}
    }
    ping();
    const id = setInterval(ping, 60000);
    return () => clearInterval(id);
  }, []);
  return null;
}
