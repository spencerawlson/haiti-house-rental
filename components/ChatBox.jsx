'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSession } from '@/lib/account';

// Discussion box between a potential tenant and the listing owner.
// The signed-in owner of this listing replies as the owner; everyone else
// writes as the tenant. Polls the thread every 5s.
export default function ChatBox({ listingId, owner, strings }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const session = getSession();
    setIsOwner(!!session && !!owner && session.username === owner);
  }, [owner]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/chat?listingId=${encodeURIComponent(listingId)}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages);
    }
  }, [listingId]);

  useEffect(() => {
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
      body: JSON.stringify({ listingId, sender: isOwner ? 'owner' : 'tenant', text }),
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

  return (
    <section className="card" style={{ marginTop: 28 }}>
      <div className="card-body">
        <h2 style={{ margin: '0 0 14px' }}>{strings.chatTitle}</h2>
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
        {sendError && <p style={{ margin: '8px 0 0', color: '#b91c1c' }}>{strings.chatSendError}</p>}
      </div>
    </section>
  );
}
