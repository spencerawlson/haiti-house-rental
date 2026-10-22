'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getSession } from '@/lib/account';

// A private conversation between one tenant and the listing owner. The
// server decides who is who from the session: a tenant always sees their
// own thread; the owner sees the tenant thread passed as `tenant` (picked
// from the Chats list). Your own messages sit on the right. Polls every 5s.
export default function ChatBox({ listingId, tenant = null, strings, locale }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [signedIn, setSignedIn] = useState(null);

  const load = useCallback(async () => {
    const q = `listingId=${encodeURIComponent(listingId)}${tenant !== null ? `&tenant=${encodeURIComponent(tenant)}` : ''}`;
    const res = await fetch(`/api/chat?${q}`);
    if (res.status === 401) {
      setSignedIn(false);
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setSignedIn(true);
    setMessages(data.messages);
    setIsOwner(!!data.isOwner);
    // Opening the chat marks the thread read for this user, so the
    // unread badge clears once the messages have actually been seen.
    if (data.tenant !== null) {
      fetch('/api/chat/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, tenant: data.tenant }),
      }).catch(() => {});
    }
  }, [listingId, tenant]);

  useEffect(() => {
    if (!getSession()) {
      setSignedIn(false);
      return undefined;
    }
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  async function send(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setSendError(false);
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, text, tenant }),
    });
    // A failed send used to clear the draft silently, so a message lost
    // to a restart or a dropped connection looked like it went through.
    // Now the draft stays and the failure shows.
    if (!res.ok) {
      setSendError(true);
      return;
    }
    setDraft('');
    load();
  }

  function label(m) {
    if (m.sender === 'owner') return isOwner ? strings.youLabel : strings.ownerLabel;
    return isOwner ? strings.tenantLabel : strings.youLabel;
  }

  // The owner opened their own listing without picking a tenant thread.
  const ownerWithoutThread = isOwner && tenant === null;
  // The anonymous legacy thread has nobody to read a reply.
  const canWrite = signedIn && !ownerWithoutThread && !(isOwner && tenant === '');

  return (
    <section className="card" style={{ marginTop: 28 }}>
      <div className="card-body">
        <h2 style={{ margin: '0 0 14px' }}>{strings.chatTitle}</h2>
        {signedIn === false && (
          <>
            <p style={{ margin: '0 0 12px' }}>{strings.chatSignIn}</p>
            <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: 0 }}>
              <Link className="btn" href={`/${locale}/signin`}>{strings.signIn}</Link>
              <Link className="btn btn-secondary" href={`/${locale}/tenants`}>{strings.createAccount}</Link>
            </p>
          </>
        )}
        {ownerWithoutThread && <p className="muted" style={{ margin: 0 }}>{strings.chatPickThread}</p>}
        {signedIn && !ownerWithoutThread && (
          <>
            {isOwner && <p className="muted" style={{ margin: '0 0 14px' }}>{strings.replyAsOwner}</p>}
            <div className="chat-box" style={{ marginBottom: 16 }}>
              {messages.map((m) => {
                const mine = isOwner ? m.sender === 'owner' : m.sender === 'tenant';
                return (
                  <p key={m.id} className={`bubble ${mine ? 'bubble-mine' : 'bubble-theirs'}`}>
                    <strong>{label(m)}:</strong> {m.text}
                  </p>
                );
              })}
            </div>
            {canWrite && (
              <form onSubmit={send} style={{ display: 'flex', gap: 8 }}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={isOwner ? strings.ownerPlaceholder : strings.chatPlaceholder}
                  className="input"
                  style={{ flex: 1 }}
                />
                <button className="btn" type="submit">{strings.send}</button>
              </form>
            )}
            {sendError && <p style={{ margin: '8px 0 0', color: '#b91c1c' }}>{strings.chatSendError}</p>}
          </>
        )}
      </div>
    </section>
  );
}
