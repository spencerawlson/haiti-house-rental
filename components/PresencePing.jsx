'use client';

import { useEffect } from 'react';
import { syncSessionHint, visitorId } from '@/lib/account';

// Heartbeat: while any Kay Ayiti page is open, ping once a minute so the
// Admin Board can show who is live. Signed-in users count by their
// session cookie; everyone else by an anonymous id kept in localStorage.
// The reply also keeps the local "signed in" hint honest (e.g. a session
// that expired, or one from before server sessions existed).
export default function PresencePing() {
  useEffect(() => {
    const visitor = visitorId();
    async function ping() {
      try {
        const res = await fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitor }),
        });
        if (res.ok) {
          const d = await res.json();
          syncSessionHint(d.username, d.avatarUrl);
        }
      } catch {}
    }
    ping();
    const id = setInterval(ping, 60000);
    return () => clearInterval(id);
  }, []);
  return null;
}
