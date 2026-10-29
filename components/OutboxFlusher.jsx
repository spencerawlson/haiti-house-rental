'use client';
import { useEffect } from 'react';
import { flush } from '@/lib/outbox';

// Headless (Phase 14c-2): replays the offline outbox when the app loads,
// when the connection returns, and when the tab is refocused. Mounted once
// in the root layout. The queue is durable (localStorage), so a send made
// with no signal survives a reload and goes out on reconnect.
export default function OutboxFlusher() {
  useEffect(() => {
    flush();
    const onOnline = () => flush();
    const onVisible = () => {
      if (document.visibilityState === 'visible') flush();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return null;
}
