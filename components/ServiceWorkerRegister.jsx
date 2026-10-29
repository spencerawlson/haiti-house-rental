'use client';
import { useEffect, useState } from 'react';

// Registers the service worker (Phase 14a) and, when a new version is
// waiting, offers a reload rather than swapping it in under the user — a
// mid-session swap can break an in-flight navigation. Rendered once in the
// root layout. Does nothing where service workers are unavailable (so the
// app is unchanged in those browsers).
export default function ServiceWorkerRegister() {
  const [waiting, setWaiting] = useState(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return; // reload once, after the new worker takes over
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // A worker already finished installing on a previous load.
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            // installed + an existing controller means an update, not the
            // first-ever install (which should activate silently).
            if (nw.state === 'installed' && navigator.serviceWorker.controller) setWaiting(nw);
          });
        });
      })
      .catch(() => {
        /* registration is best-effort; the app works fine without it */
      });

    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  if (!waiting) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(12px + env(safe-area-inset-bottom))',
        zIndex: 9999,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#0f172a',
        color: '#fff',
        borderRadius: 14,
        padding: '12px 16px',
        boxShadow: '0 8px 24px rgba(0,0,0,.25)',
        fontWeight: 700,
      }}
    >
      <span>Yon nouvo vèsyon pare.</span>
      <button
        type="button"
        onClick={() => waiting.postMessage('SKIP_WAITING')}
        style={{
          border: 0,
          borderRadius: 999,
          padding: '8px 18px',
          fontWeight: 800,
          background: '#f87171',
          color: '#fff',
          cursor: 'pointer',
        }}
      >
        Mete ajou
      </button>
    </div>
  );
}
