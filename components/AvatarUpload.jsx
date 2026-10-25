'use client';

import { useRef, useState } from 'react';
import { compressImage } from '@/lib/image-compress';
import { syncSessionHint } from '@/lib/account';
import Icon from '@/components/Icon';

// The profile circle on the Account page. It used to be initials only,
// with no way to put a real face on it. Now the circle IS the button: tap
// it, pick a photo, and it replaces the initials; a small × removes it.
// The photo is shrunk in the browser first (lib/image-compress.js, the
// same path listing photos take) so a 6 MB phone picture does not cost
// 6 MB of Haitian mobile data to send.
//
// Initials stay the fallback: no photo, a removed photo, or a file that
// fails to load all show them, so the header never collapses.
function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
}

export default function AvatarUpload({ account, onChange, t }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [broken, setBroken] = useState(false);
  const showPhoto = !!account.avatarUrl && !broken;

  async function send(run, failMessage) {
    setError('');
    setBusy(true);
    try {
      const res = await run();
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.account) throw new Error(data.error || 'failed');
      setBroken(false);
      // So the tab bar picks the new photo up without waiting for the
      // next presence ping.
      syncSessionHint(data.account.username, data.account.avatarUrl);
      onChange(data.account);
    } catch {
      setError(failMessage);
    } finally {
      setBusy(false);
    }
  }

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // picking the same file twice must still fire
    if (!file) return;
    const body = new FormData();
    body.append('file', await compressImage(file));
    await send(() => fetch('/api/accounts/avatar', { method: 'POST', body }), t.photoUploadFailed);
  }

  return (
    <div className="avatar-wrap">
      <button
        type="button"
        className="avatar-btn"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        aria-label={showPhoto ? t.changePhoto : t.addPhoto}
      >
        {showPhoto ? (
          <img className="avatar-photo" src={account.avatarUrl} alt="" onError={() => setBroken(true)} />
        ) : (
          <span className="avatar" aria-hidden="true">{initials(account.name)}</span>
        )}
        <span className="avatar-edit" aria-hidden="true">{busy ? '⋯' : <Icon name="camera" />}</span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={pick} hidden />
      {showPhoto && (
        <button
          type="button"
          className="avatar-remove"
          onClick={() => send(() => fetch('/api/accounts/avatar', { method: 'DELETE' }), t.photoUploadFailed)}
          disabled={busy}
          aria-label={t.removePhoto}
        >
          ×
        </button>
      )}
      {error && <p className="avatar-error" role="alert">{error}</p>}
    </div>
  );
}
