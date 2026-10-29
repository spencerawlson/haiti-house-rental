'use client';

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { getSession } from '@/lib/account';
import ReportForm from './ReportForm';
import VisitScheduler from './VisitScheduler';
import VoiceRecorder from './VoiceRecorder';
import VoiceMessage from './VoiceMessage';
import Icon from '@/components/Icon';
import { photoSrc } from '@/lib/photo-url';
import { enqueue, pendingChat, subscribe, newClientId, flush } from '@/lib/outbox';

// A private conversation between one tenant and the listing owner,
// structured like WhatsApp / Messenger: a pinned header, a message area
// that scrolls on its own and stays on the newest message, and a
// composer at the bottom. The server decides who is who from the
// session: a tenant always sees their own thread; the owner sees the
// tenant thread passed as `tenant`. Either side can block (no new
// messages) or report the conversation to the admin, and either side can
// schedule a visit — the same scheduler as the listing page, so a
// proposal made in chat is answered in chat. Polls every 5s.
//
// Visiting a home is what the product is for, so the calendar stays a
// one-tap button in the header; block and report sit behind the overflow
// menu, where both apps keep the rare, destructive actions.
export default function ChatBox({ listingId, tenant = null, listing = null, strings, locale, otherName = null, otherAvatarUrl = null, onBack = null }) {
  const [messages, setMessages] = useState([]);
  // Messages typed with no connection, waiting in the offline outbox.
  const [pending, setPending] = useState([]);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [signedIn, setSignedIn] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // closed = no new messages. landlordLeft = the home was deleted, so the
  // landlord is out of the conversation for good. The tenant keeps every
  // message either way — their history is theirs.
  const [closed, setClosed] = useState(false);
  const [landlordLeft, setLandlordLeft] = useState(false);
  // otherSuspended = the counterpart is fraud-suspended (0021): the
  // thread shows a neutral "unavailable" line, no reason, no label.
  const [otherSuspended, setOtherSuspended] = useState(false);
  // Typing/delivered/read ride the same 5s poll as everything else — see
  // app/api/chat/route.js GET. otherTyping expires on its own server-side
  // (lib/typing.js TTL); readThroughAt/deliveredThroughAt are the other
  // person's timestamps, compared against each of MY OWN messages to
  // pick the tick: one check (sent), two (delivered), two blue (read).
  const [otherTyping, setOtherTyping] = useState(false);
  const [readThroughAt, setReadThroughAt] = useState(0);
  const [deliveredThroughAt, setDeliveredThroughAt] = useState(0);
  const typingPingRef = useRef(0);
  const endRef = useRef(null);
  const countRef = useRef(0);

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
    setOtherTyping(!!data.otherTyping);
    setReadThroughAt(Number(data.readThroughAt) || 0);
    setDeliveredThroughAt(Number(data.deliveredThroughAt) || 0);
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
    // Each tick also drains the outbox, so a message typed with no signal
    // goes out within 5s of the connection returning even without leaving
    // the chat. flush() is a no-op when the queue is empty.
    const timer = setInterval(async () => {
      await flush(); // send queued messages first, so the reload below shows them
      load().catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [load]);

  // The outbox messages still waiting for THIS thread, shown as faded
  // "sending" bubbles until the server confirms them. Refreshed on the
  // outbox's own change events (this tab and others).
  const refreshPending = useCallback(() => {
    setPending(pendingChat(listingId, isOwner ? tenant : null));
  }, [listingId, tenant, isOwner]);

  useEffect(() => {
    refreshPending();
    return subscribe(refreshPending);
  }, [refreshPending]);

  // Stay on the newest message: jump on first paint, glide afterwards,
  // and only when the count actually grew — a 5s poll that changes
  // nothing must not yank someone who scrolled up to read.
  useEffect(() => {
    if (messages.length === countRef.current) return;
    const first = countRef.current === 0;
    countRef.current = messages.length;
    endRef.current?.scrollIntoView({ block: 'end', behavior: first ? 'auto' : 'smooth' });
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setSendError('');
    // The idempotency key (0025) travels with the message, so a retry from
    // the outbox can never post it twice.
    const body = { listingId, text, tenant: threadTenant, clientId: newClientId() };
    setDraft('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === 'landlord_left') {
          setLandlordLeft(true);
          setClosed(true);
          return;
        }
        // The server rejected it (blocked, suspended, …): it won't succeed
        // on retry, so don't queue it. Put the text back so they can see
        // what happened and decide.
        setSendError(data.error === 'blocked' ? strings.chatBlocked : strings.chatSendError);
        setDraft(text);
        return;
      }
      load();
    } catch {
      // No connection: queue it durably and show it pending. The flusher
      // (and the 5s poll above) send it once the connection returns.
      enqueue({ kind: 'chat', url: '/api/chat', body });
      refreshPending();
    }
  }

  // A voice note has already been uploaded (VoiceRecorder) by the time
  // this runs — same POST/error-handling shape as send(), just with
  // audio fields instead of text.
  async function sendVoice(url, durationMs, peaks) {
    setSendError('');
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, tenant: threadTenant, audioUrl: url, audioDurationMs: durationMs, audioPeaks: peaks }),
    });
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
    load();
  }

  // Debounced "I'm typing" ping — at most once every ~2.5s while the
  // draft keeps changing, so a whole message isn't one ping per keystroke.
  function onDraftChange(e) {
    const value = e.target.value;
    setDraft(value);
    const now = Date.now();
    if (value.trim() && now - typingPingRef.current > 2500) {
      typingPingRef.current = now;
      fetch('/api/chat/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, tenant: threadTenant }),
      }).catch(() => {});
    }
  }

  async function toggleBlock() {
    setMenuOpen(false);
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

  const intl = locale === 'ht' ? 'fr' : locale;

  function at(ms) {
    return new Date(ms).toLocaleTimeString(intl, { hour: '2-digit', minute: '2-digit' });
  }

  // Day separators. Today and yesterday are translated; anything older
  // uses the locale's own date format.
  function dayKey(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }
  function dayLabel(ms) {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (dayKey(ms) === dayKey(now.getTime())) return strings.chatToday;
    if (dayKey(ms) === dayKey(yesterday.getTime())) return strings.chatYesterday;
    return new Date(ms).toLocaleDateString(intl, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // The owner opened their own listing without picking a tenant thread.
  const ownerWithoutThread = isOwner && tenant === null;
  const blocked = !!conversation?.blocked;
  // The anonymous legacy thread has nobody to read a reply.
  const canWrite = signedIn && !ownerWithoutThread && !(isOwner && tenant === '') && !blocked && !closed && !otherSuspended;
  const title = otherName || listing?.title || strings.chatTitle;

  // One line at the foot of the thread, in place of the composer, when
  // writing is not possible.
  function footNote() {
    if (ownerWithoutThread) return strings.chatPickThread;
    if (blocked) return conversation.blockedByMe ? strings.chatBlockedByMe : strings.chatBlocked;
    if (closed) return landlordLeft ? strings.chatLandlordLeft : strings.chatListingGone;
    if (otherSuspended) return strings.fraudChatUnavailable;
    return null;
  }
  const note = signedIn ? footNote() : null;

  return (
    <div className="wa-chat">
      <header className="wa-chat-head" style={{ position: 'relative' }}>
        {onBack && (
          <button type="button" className="wa-icon-btn" onClick={onBack} aria-label={strings.back}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        )}
        {otherAvatarUrl ? (
          <img className="wa-avatar" style={{ width: 38, height: 38 }} src={photoSrc(otherAvatarUrl, 160)} alt="" />
        ) : (
          <span className="wa-avatar" style={{ width: 38, height: 38 }} aria-hidden="true"><Icon name="user" size={18} /></span>
        )}
        <span className="wa-head-main">
          <span className="wa-head-name">{title}</span>
          {listing && (
            <Link className="wa-head-sub" href={`/${locale}/listings/${listing.id}`}>
              {listing.title} · {Number(listing.price || 0).toLocaleString()} {listing.currency || 'HTG'}
            </Link>
          )}
        </span>
        {conversation && !blocked && !closed && (
          <button type="button" className="wa-icon-btn" aria-label={strings.scheduleVisit} onClick={() => { setScheduling((s) => !s); setReporting(false); setMenuOpen(false); }}>
            {/* Sized to match the back chevron; the 1em default left it
                visibly smaller than the other two header controls. */}
            <Icon name="calendar" size={22} />
          </button>
        )}
        {conversation && (
          <button type="button" className="wa-icon-btn" aria-label={strings.reportChat} aria-expanded={menuOpen} onClick={() => setMenuOpen((m) => !m)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
          </button>
        )}
        {menuOpen && conversation && (
          <div className="wa-menu">
            {(!blocked || conversation.blockedByMe) && (
              <button type="button" onClick={toggleBlock}>{blocked ? strings.unblockChat : strings.blockChat}</button>
            )}
            <button type="button" onClick={() => { setReporting((r) => !r); setScheduling(false); setMenuOpen(false); }}>{strings.reportChat}</button>
          </div>
        )}
      </header>

      <div className="wa-msgs" onClick={() => menuOpen && setMenuOpen(false)}>
        {reporting && conversation && (
          <div style={{ marginBottom: 10 }}>
            <ReportForm kind="conversation" listingId={listingId} tenant={threadTenant} strings={strings} onDone={() => setReporting(false)} />
          </div>
        )}
        {scheduling && conversation && (
          <div style={{ marginBottom: 10 }}>
            <VisitScheduler listingId={listingId} owner={listing?.owner} strings={strings} locale={locale} />
          </div>
        )}
        {signedIn === false && (
          <div style={{ margin: 'auto', textAlign: 'center' }}>
            <p>{strings.chatSignIn}</p>
            <p style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link className="btn" href={`/${locale}/signin`}>{strings.signIn}</Link>
              <Link className="btn btn-secondary" href={`/${locale}/tenants`}>{strings.createAccount}</Link>
            </p>
          </div>
        )}
        {signedIn && isOwner && !ownerWithoutThread && (
          <span className="wa-day" style={{ marginTop: 0 }}>{strings.replyAsOwner}</span>
        )}
        {signedIn && messages.map((m, i) => {
          const mine = isOwner ? m.sender === 'owner' : m.sender === 'tenant';
          const prev = messages[i - 1];
          const prevMine = prev && (isOwner ? prev.sender === 'owner' : prev.sender === 'tenant');
          // First of a run: a new sender, or the first message of a day.
          const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
          const first = newDay || prevMine !== mine;
          // Per-message receipt, same tick WhatsApp uses: one check once
          // it's on the server, two once the other side's device has
          // been in contact with the server since (login_events, via the
          // presence ping), two in blue once they've actually opened
          // this thread (chat_reads) — see app/api/chat/route.js GET.
          const tickStatus = mine ? (m.at <= readThroughAt ? 'read' : m.at <= deliveredThroughAt ? 'delivered' : 'sent') : null;
          return (
            <Fragment key={m.id}>
              {newDay && <span className="wa-day">{dayLabel(m.at)}</span>}
              <p className={`wa-b ${mine ? 'wa-b-mine' : 'wa-b-theirs'}${first ? ' wa-b-first' : ''}`}>
                <span className="sr-only">{label(m)}: </span>
                {m.audioUrl ? (
                  <VoiceMessage url={m.audioUrl} durationMs={m.audioDurationMs} peaks={m.audioPeaks} label={strings.voiceMessage} />
                ) : m.text}
                <span className="wa-meta">
                  {at(m.at)}
                  {mine && (
                    <span className={`wa-tick${tickStatus === 'read' ? ' wa-tick-read' : ''}`} aria-hidden="true">
                      {tickStatus === 'sent' ? '✓' : '✓✓'}
                    </span>
                  )}
                  {mine && tickStatus !== 'sent' && (
                    <span className="sr-only">{tickStatus === 'read' ? strings.statusRead : strings.statusDelivered}</span>
                  )}
                </span>
              </p>
            </Fragment>
          );
        })}
        {/* Still in the outbox: my messages typed offline, hidden once the
            server confirms them (same clientId arrives in `messages`). */}
        {signedIn && pending
          .filter((p) => !messages.some((m) => m.clientId && m.clientId === p.body.clientId))
          .map((p) => (
            <p key={p.id} className="wa-b wa-b-mine wa-b-first" style={{ opacity: 0.6 }}>
              {p.body.text}
              <span className="wa-meta">
                {at(p.createdAt)}
                <span className="wa-tick" aria-hidden="true">🕗</span>
                <span className="sr-only">{strings.chatQueued}</span>
              </span>
            </p>
          ))}
        {otherTyping && (
          <p className="wa-b wa-b-theirs wa-b-first" style={{ fontStyle: 'italic' }}>{strings.typingIndicator}</p>
        )}
        <span ref={endRef} />
      </div>

      {sendError && <p className="wa-foot-note" style={{ color: '#b91c1c' }}>{sendError}</p>}
      {note && <p className="wa-foot-note">{note}</p>}
      {canWrite && (
        <form onSubmit={send} className="wa-composer">
          <input
            value={draft}
            onChange={onDraftChange}
            placeholder={isOwner ? strings.ownerPlaceholder : strings.chatPlaceholder}
            className="input"
            maxLength={2000}
          />
          <VoiceRecorder listingId={listingId} tenant={threadTenant} onSend={sendVoice} strings={strings} />
          <button className="wa-send" type="submit" aria-label={strings.send} disabled={!draft.trim()}>➤</button>
        </form>
      )}
    </div>
  );
}
