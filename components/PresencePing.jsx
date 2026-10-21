'use client';

import { useEffect } from 'react';
import { getSession } from '@/lib/account';

const VISITOR_KEY = 'kay-visitor';

// Heartbeat: while any Kay Ayiti page is open, ping once a minute so the
// Admin Board can show who is live. Signed-in users ping with their
// username; everyone else pings with an anonymous id kept in localStorage.
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
      const session = getSession();
      try {
        await fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: session?.username || null, visitor }),
        });
      } catch {}
    }
    ping();
    const id = setInterval(ping, 60000);
    return () => clearInterval(id);
  }, []);
  return null;
}
