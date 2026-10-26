'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getSession } from '@/lib/account';
import ReportForm from './ReportForm';
import VisitScheduler from './VisitScheduler';
import Icon from '@/components/Icon';

// A private conversation between one tenant and the listing owner
// (design: docs/design/app-showcase.png, screen 9 — listing card on top,
// bubbles, round send button). The server decides who is who from the
// session: a tenant always sees their own thread; the owner sees the
// tenant thread passed as `tenant`. Either side can block (no new
// messages) or report the conversation to the admin. Either side can
// also schedule a visit from here — the same scheduler as the listing
// page, so a proposal made in chat is answered in chat. Polls every 5s.
export default function ChatBox({ listingId, tenant = null, listing = null, strings, locale }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [signedIn, setSignedIn] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  // closed = no new messages. landlordLeft = the home was deleted, so the
  // landlord is out of the conversation for good. The tenant keeps every
  // message either way — their history is theirs.
  const [closed, setClosed] = useState(false);
  const [landlordLeft, setLandlordLeft] = useState(false);
  // otherSuspended = the counterpart is fraud-suspended (0021): the
  // thread shows a neutral "unavailable" line, no reason, no label.
  const [otherSuspended, setOtherSuspended] = useState(false);

  const threadTenant = isOwner ? tenant : null;

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
    setConversation(data.conversation);
    setClosed(!!data.closed);
    setLandlordLeft(!!data.landlordLeft);
    setOtherSuspended(!!data.otherSuspended);
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
    setSendError('');
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, text, tenant: threadTenant }),
    });
    // A failed send keeps the draft and says so, instead of silently
    // losing the message.
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === 'landlord_left') {
        setLandlordLeft(true);
        setClosed(true);
        setSendError('');
        return;
      }
      setSendError(data.error === 'blocked' ? strings.chatBlocked : strings.chatSendError);
      return;
    }
    setDraft('');
    load();
  }

  async function toggleBlock() {
    const blocking = !conversation?.blocked;
    if (blocking && !window.confirm(strings.blockConfirm)) return;
    const res = await fetch('/api/chat/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, tenant: threadTenant, blocked: blocking }),
    });
    if (res.ok) setConversation((await res.json()).conversation);
  }

  function label(m) {
    if (m.sender === 'owner') return isOwner ? strings.youLabel : strings.ownerLabel;
    return isOwner ? strings.tenantLabel : strings.youLabel;
  }

  function at(ms) {
    return new Date(ms).toLocaleTimeString(locale === 'ht' ? 'fr' : locale, { hour: '2-digit', minute: '2-digit' });
  }

  // The owner opened their own listing without picking a tenant thread.
  const ownerWithoutThread = isOwner && tenant === null;
  const blocked = !!conversation?.blocked;
  // The anonymous legacy thread has nobody to read a reply.
  const canWrite = signedIn && !ownerWithoutThread && !(isOwner && tenant === '') && !blocked && !closed && !otherSuspended;

  return (
    <section className="card" style={{ marginTop: 20 }}>
      <div className="card-body">
        {listing && (
          <Link href={`/${locale}/listings/${listing.id}`} className="chat-listing" style={{ color: 'inherit', marginBottom: 14 }}>
            {listing.photos?.[0] ? <img src={listing.photos[0]} alt="" /> : <span className="thumb" />}
            <span style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.title}</strong>
              <span className="muted" style={{ fontSize: '0.88rem' }}>{Number(listing.price || 0).toLocaleString()} {listing.currency || 'HTG'} · {listing.commune}</span>
            </span>
          </Link>
        )}
        <div className="chat-head">
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{strings.chatTitle}</h2>
          {conversation && (
            <span style={{ display: 'flex', gap: 4 }}>
              {!blocked && !closed && (
                <button type="button" className="link-btn" onClick={() => { setScheduling((s) => !s); setReporting(false); }}><Icon name="calendar" /> {strings.scheduleVisit}</button>
              )}
              {(!blocked || conversation.blockedByMe) && (
                <button type="button" className="link-btn" onClick={toggleBlock}>{blocked ? strings.unblockChat : `⊘ ${strings.blockChat}`}</button>
              )}
              <button type="button" className="link-btn" onClick={() => { setReporting((r) => !r); setScheduling(false); }}><Icon name="flag" /> {strings.reportChat}</button>
            </span>
          )}
        </div>
        {reporting && conversation && (
          <div style={{ marginBottom: 14 }}>
            <ReportForm kind="conversation" listingId={listingId} tenant={threadTenant} strings={strings} onDone={() => setReporting(false)} />
          </div>
        )}
        {scheduling && conversation && (
          <div style={{ marginBottom: 14 }}>
            <VisitScheduler listingId={listingId} owner={listing?.owner} strings={strings} locale={locale} />
          </div>
        )}
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
                  <div key={m.id} style={{ display: 'grid', justifyItems: mine ? 'end' : 'start', gap: 2 }}>
                    <p className={`bubble ${mine ? 'bubble-mine' : 'bubble-theirs'}`} style={{ margin: 0 }}>
                      <span className="sr-only">{label(m)}: </span>{m.text}
                    </p>
                    <span className="muted" style={{ fontSize: '0.72rem' }}>{at(m.at)}</span>
                  </div>
                );
              })}
            </div>
            {blocked && (
              <p className="notice" style={{ margin: '0 0 12px' }}>{conversation.blockedByMe ? strings.chatBlockedByMe : strings.chatBlocked}</p>
            )}
            {!blocked && closed && (
              <p className="notice" style={{ margin: '0 0 12px' }}>
                {landlordLeft ? strings.chatLandlordLeft : strings.chatListingGone}
              </p>
            )}
            {otherSuspended && (
              <p className="notice" style={{ margin: '0 0 12px' }}>{strings.fraudChatUnavailable}</p>
            )}
            {canWrite && (
              <form onSubmit={send} className="chat-composer">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={isOwner ? strings.ownerPlaceholder : strings.chatPlaceholder}
                  className="input"
                  style={{ flex: 1 }}
                  maxLength={2000}
                />
                <button className="send-btn" type="submit" aria-label={strings.send}>➤</button>
              </form>
            )}
            {sendError && <p style={{ margin: '8px 0 0', color: '#b91c1c' }}>{sendError}</p>}
          </>
        )}
      </div>
    </section>
  );
}
