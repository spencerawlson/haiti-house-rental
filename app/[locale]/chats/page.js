'use client';

import Link from 'next/link';
import { useEffect, useState, use } from 'react';
import { getDict } from '@/lib/dictionaries';
import { getSession } from '@/lib/account';
import TabBar from '@/components/TabBar';
import ChatBox from '@/components/ChatBox';

// The dedicated chat spot, structured like WhatsApp / Messenger: a list
// of thread rows (avatar, name, one-line preview, time, unread pill),
// and tapping one opens the conversation full-screen over it. The
// listing page's Contact button lands here with ?listingId=, so chats no
// longer live at the bottom of listing pages. Threads are one listing +
// one tenant: an owner's inbox links carry &tenant= to open that
// tenant's conversation.
//
// Long-press (or right-click) a row to delete it on this side — the
// button on every card is gone, as it is in both apps.
export default function Chats(props) {
  const params = use(props.params);
  const t = getDict(params.locale);
  const [me, setMe] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [listing, setListing] = useState(null);

  function loadThreads() {
    fetch('/api/chat/inbox')
      .then((r) => r.json())
      .then((d) => setThreads(d.threads || []))
      .catch(() => {});
  }

  useEffect(() => {
    const session = getSession();
    setMe(session);
    setLoaded(true);
    if (session) loadThreads();
    const q = new URLSearchParams(window.location.search);
    if (q.get('listingId')) setSelectedId(q.get('listingId'));
    if (q.has('tenant')) setSelectedTenant(q.get('tenant'));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setListing(null);
      return;
    }
    fetch(`/api/listings?id=${encodeURIComponent(selectedId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setListing(d?.listing || null))
      .catch(() => setListing(null));
  }, [selectedId]);

  // An open conversation covers the screen, so the page behind it must
  // not scroll under the fixed panel.
  useEffect(() => {
    if (!selectedId) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [selectedId]);

  async function deleteThread(th) {
    if (!window.confirm(t.deleteChatConfirm)) return;
    await fetch('/api/chat/hide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId: th.listingId, tenant: th.tenant }),
    });
    setThreads((prev) => prev.filter((x) => x.key !== th.key));
  }

  function openThread(th) {
    setSelectedId(th.listingId);
    setSelectedTenant(th.isOwner ? th.tenant : null);
  }

  function backToList() {
    setSelectedId(null);
    setSelectedTenant(null);
    if (me) loadThreads();
  }

  const selectedThread = threads.find(
    (th) => th.listingId === selectedId && (selectedTenant === null ? !th.isOwner : th.isOwner && th.tenant === selectedTenant),
  );

  const intl = params.locale === 'ht' ? 'fr' : params.locale;

  // Time on the right of a row: the clock for today, the weekday this
  // week, a date beyond that — the same ladder both apps use.
  function rowTime(ms) {
    if (!ms) return '';
    const d = new Date(ms);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString(intl, { hour: '2-digit', minute: '2-digit' });
    if (now - d < 7 * 24 * 60 * 60 * 1000) return d.toLocaleDateString(intl, { weekday: 'long' });
    return d.toLocaleDateString(intl, { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  return (
    <>
      {!selectedId && (
        <>
          <main className="container">
            <h1 className="page-title">{t.chat}</h1>
            {loaded && !me && (
              <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link className="btn" href={`/${params.locale}/signup`}>{t.createAccount}</Link>
                <Link className="btn btn-secondary" href={`/${params.locale}/signin`}>{t.signIn}</Link>
              </p>
            )}
            {loaded && me && threads.length === 0 && <p className="muted">{t.noMessages}</p>}
            {loaded && threads.length > 0 && (
              <div className="wa-list">
                {threads.map((th) => {
                  const name = th.otherName || th.listingTitle || '';
                  // The preview says who spoke last, as both apps do.
                  const fromMe = th.isOwner ? th.lastSender === 'owner' : th.lastSender === 'tenant';
                  return (
                    <button
                      key={th.key}
                      type="button"
                      className={`wa-row${th.unread > 0 ? ' wa-row-unread' : ''}`}
                      onClick={() => openThread(th)}
                      onContextMenu={(e) => { e.preventDefault(); deleteThread(th); }}
                      aria-label={`${name}${th.unread > 0 ? ` (${th.unread})` : ''}`}
                    >
                      <span className="wa-avatar" aria-hidden="true">{(name || '?').trim().charAt(0).toUpperCase()}</span>
                      <span className="wa-row-main">
                        <span className="wa-row-top">
                          <span className="wa-name">{name}</span>
                          <span className="wa-time">{rowTime(th.lastAt)}</span>
                        </span>
                        <span className="wa-row-bottom">
                          {fromMe && <span className="wa-tick" aria-hidden="true">✓</span>}
                          <span className="wa-preview">{th.lastText}</span>
                          {th.unread > 0 && <span className="wa-unread">{th.unread}</span>}
                        </span>
                        {/* Which home the thread is about — WhatsApp has no
                            equivalent, but here it is the whole point. */}
                        {th.otherName && th.listingTitle && (
                          <span className="wa-preview" style={{ fontSize: '0.78rem' }}>{th.listingTitle}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </main>
          <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
        </>
      )}
      {loaded && selectedId && (
        listing ? (
          <ChatBox
            listingId={listing.id}
            tenant={selectedTenant}
            listing={listing}
            otherName={selectedThread?.otherName || null}
            onBack={backToList}
            strings={t}
            locale={params.locale}
          />
        ) : (
          <main className="container">
            <p><button className="btn btn-secondary" type="button" onClick={backToList} style={{ minHeight: 40, padding: '8px 16px' }}>← {t.back}</button></p>
            <p className="muted">{t.notFound}</p>
          </main>
        )
      )}
    </>
  );
}
