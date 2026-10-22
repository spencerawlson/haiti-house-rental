'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getDict } from '@/lib/dictionaries';
import { getSession } from '@/lib/account';
import TabBar from '@/components/TabBar';
import ChatBox from '@/components/ChatBox';

// The dedicated chat spot. The thread list (with unread counts and a
// per-side delete) is here, and tapping a thread opens the conversation
// here too — the listing page's Contact button lands here with
// ?listingId=, so chats no longer live at the bottom of listing pages.
// Threads are one listing + one tenant: an owner's inbox links carry
// &tenant= to open that tenant's conversation.
export default function Chats({ params }) {
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

  return (
    <>
      <main className="container">
        <h1>{t.chat}</h1>
        {loaded && !me && !selectedId && (
          <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn" href={`/${params.locale}/signup`}>{t.createAccount}</Link>
            <Link className="btn btn-secondary" href={`/${params.locale}/signin`}>{t.signIn}</Link>
          </p>
        )}
        {loaded && !selectedId && me && threads.length === 0 && <p className="muted">{t.noMessages}</p>}
        {loaded && !selectedId && (
          <div className="grid">
            {threads.map((th) => (
              <section key={th.key} className="card">
                <div className="card-body">
                  <p style={{ margin: '0 0 2px' }}>
                    <button type="button" onClick={() => openThread(th)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontWeight: 700, color: 'var(--primary)', textAlign: 'left' }}>
                      {th.otherName || th.listingTitle}
                    </button>
                    {th.unread > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, height: 20, padding: '0 5px', borderRadius: 999, background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 800, marginLeft: 8 }}>
                        {th.unread}
                      </span>
                    )}
                  </p>
                  {th.otherName && <p className="muted" style={{ margin: '0 0 4px' }}>{th.listingTitle}</p>}
                  <p className="muted" style={{ margin: '0 0 12px' }}>{th.lastText}</p>
                  <button className="btn btn-secondary" type="button" onClick={() => deleteThread(th)} style={{ minHeight: 40, padding: '8px 16px' }}>🗑️ {t.deleteChat}</button>
                </div>
              </section>
            ))}
          </div>
        )}
        {loaded && selectedId && (
          <>
            <p><button className="btn btn-secondary" type="button" onClick={backToList} style={{ minHeight: 40, padding: '8px 16px' }}>← {t.back}</button></p>
            {!listing && <p className="muted">{t.notFound}</p>}
            {listing && (
              <>
                <h2 style={{ margin: '0 0 4px' }}>{selectedThread?.otherName || listing.title}</h2>
                {selectedThread?.otherName && (
                  <p className="muted" style={{ margin: '0 0 12px' }}>{listing.title}</p>
                )}
                <ChatBox listingId={listing.id} tenant={selectedTenant} listing={listing} strings={t} locale={params.locale} />
              </>
            )}
          </>
        )}
      </main>
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
