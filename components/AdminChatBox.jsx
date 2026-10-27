'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getSession } from '@/lib/account';
import Icon from '@/components/Icon';

// Admin chat: the same look as the listing chat (bubbles, round send
// button, 5s polling) but for the admin thread, which is not about a
// home. mode 'user' is the signed-in user's own thread ("Contact
// admin"); mode 'admin' is one user's thread, opened from the Admin
// Board or an account row. The Improve button exists in admin mode
// only, and only when the server says an AI key is configured — the
// button fills the composer with the rewrite; the admin still sends
// it manually.
export default function AdminChatBox({ mode, username = null, strings, locale }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const [signedIn, setSignedIn] = useState(null);
  const [improveAvailable, setImproveAvailable] = useState(false);
  const [improving, setImproving] = useState(false);
  const isAdmin = mode === 'admin';

  const load = useCallback(async () => {
    const url = isAdmin ? `/api/admin/admin-chat?username=${encodeURIComponent(username)}` : '/api/admin-chat';
    const res = await fetch(url);
    if (res.status === 401) {
      setSignedIn(false);
      return;
    }
    if (!res.ok) return;
    setSignedIn(true);
    setMessages((await res.json()).messages || []);
  }, [isAdmin, username]);

  useEffect(() => {
    if (!isAdmin && !getSession()) {
      setSignedIn(false);
      return undefined;
    }
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/admin/admin-chat/improve')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setImproveAvailable(!!d?.available))
      .catch(() => {});
  }, [isAdmin]);

  async function send(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setSendError('');
    const url = isAdmin ? '/api/admin/admin-chat' : '/api/admin-chat';
    const body = isAdmin ? { username, text } : { text };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSendError(data.error === 'suspended' ? strings.adminChatSuspended : strings.chatSendError);
      return;
    }
    setDraft('');
    load();
  }

  async function improve() {
    const text = draft.trim();
    if (!text || improving) return;
    setImproving(true);
    setSendError('');
    try {
      const res = await fetch('/api/admin/admin-chat/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.improved) setDraft(data.improved);
      else setSendError(strings.chatSendError);
    } catch {
      setSendError(strings.chatSendError);
    } finally {
      setImproving(false);
    }
  }

  function at(ms) {
    return new Date(ms).toLocaleTimeString(locale === 'ht' ? 'fr' : locale, { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <section className="card" style={{ marginTop: 20 }}>
      <div className="card-body">
        <div className="chat-head">
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{strings.adminChatTitle}</h2>
        </div>
        {signedIn === false && (
          <>
            <p style={{ margin: '0 0 12px' }}>{strings.adminChatSignIn}</p>
            <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: 0 }}>
              <Link className="btn" href={isAdmin ? `/${locale}/admin-login` : `/${locale}/signin`}>{strings.signIn}</Link>
            </p>
          </>
        )}
        {signedIn && (
          <>
            <div className="chat-box" style={{ marginBottom: 16 }}>
              {messages.map((m) => {
                const mine = isAdmin ? m.sender === 'admin' : m.sender === 'user';
                return (
                  <div key={m.id} style={{ display: 'grid', justifyItems: mine ? 'end' : 'start', gap: 2 }}>
                    <p className={`bubble ${mine ? 'bubble-mine' : 'bubble-theirs'}`} style={{ margin: 0 }}>
                      {m.text}
                    </p>
                    <span className="muted" style={{ fontSize: '0.72rem' }}>{at(m.at)}</span>
                  </div>
                );
              })}
            </div>
            <form onSubmit={send} className="chat-composer">
              <input
                className="input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={strings.chatPlaceholder}
                style={{ flex: 1 }}
                maxLength={2000}
              />
              {isAdmin && improveAvailable && (
                <button type="button" className="btn btn-secondary" onClick={improve} disabled={improving || !draft.trim()} style={{ minHeight: 40, padding: '8px 14px' }}>
                  <Icon name="sparkles" /> {strings.adminChatImprove}
                </button>
              )}
              <button className="send-btn" type="submit" aria-label={strings.send}>➤</button>
            </form>
            {sendError && <p style={{ color: '#dc2626', margin: '8px 0 0' }}>{sendError}</p>}
          </>
        )}
      </div>
    </section>
  );
}
