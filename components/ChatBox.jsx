'use client';

import { useCallback, useEffect, useState } from 'react';

// Discussion box between a potential tenant and the listing owner.
// v0: the visitor writes as the tenant; the owner side is seeded and
// replies once landlord accounts exist. Polls the thread every 5s.
export default function ChatBox({ listingId, strings }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');

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
    setDraft('');
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, sender: 'tenant', text }),
    });
    load();
  }

  return (
    <section className="card" style={{ marginTop: 28 }}>
      <div className="card-body">
        <h2 style={{ margin: '0 0 14px' }}>{strings.chatTitle}</h2>
        <div className="chat-box" style={{ marginBottom: 16 }}>
          {messages.map((m) => (
            <p key={m.id} className={`bubble ${m.sender === 'tenant' ? 'bubble-tenant' : 'bubble-owner'}`}>
              <strong>{m.sender === 'tenant' ? strings.youLabel : strings.ownerLabel}:</strong> {m.text}
            </p>
          ))}
        </div>
        <form onSubmit={send} style={{ display: 'flex', gap: 8 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={strings.chatPlaceholder}
            className="input"
            style={{ flex: 1 }}
          />
          <button className="btn" type="submit">{strings.send}</button>
        </form>
      </div>
    </section>
  );
}
