'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getSession } from '@/lib/account';

// Visit appointments on a listing, shared between tenant and owner.
// Tenant (signed in) proposes date + time; the listing owner confirms or
// declines. Both sides see the same list here and in Account → My visits.
export default function VisitScheduler({ listingId, owner, strings, locale }) {
  const [visits, setVisits] = useState([]);
  const [session, setSession] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isOwner = !!session && !!owner && session.username === owner;

  const load = useCallback(async () => {
    const res = await fetch(`/api/visits?listingId=${encodeURIComponent(listingId)}`);
    if (res.ok) {
      const data = await res.json();
      setVisits(data.visits);
    }
  }, [listingId]);

  useEffect(() => {
    setSession(getSession());
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  async function propose(e) {
    e.preventDefault();
    setError('');
    if (!date || !time) {
      setError(strings.visitInvalid);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (date < today) {
      setError(strings.visitInvalid);
      return;
    }
    const res = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, tenant: session.username, date, time, message }),
    });
    if (!res.ok) {
      setError(strings.visitInvalid);
      return;
    }
    setDate('');
    setTime('');
    setMessage('');
    load();
  }

  async function decide(id, status) {
    await fetch('/api/visits/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, username: session.username }),
    });
    load();
  }

  function statusLabel(v) {
    if (v.status === 'confirmed') return strings.visitConfirmed;
    if (v.status === 'declined') return strings.visitDeclined;
    return strings.visitProposed;
  }

  const mine = session ? visits.filter((v) => v.tenant === session.username || v.owner === session.username) : [];

  return (
    <section className="card" style={{ marginTop: 28 }}>
      <div className="card-body">
        <h2 style={{ margin: '0 0 14px' }}>{strings.scheduleVisit}</h2>
        {!session ? (
          <p>
            <Link className="btn" href={`/${locale}/signup`}>{strings.signInToSchedule}</Link>
          </p>
        ) : !isOwner ? (
          <form onSubmit={propose} style={{ display: 'grid', gap: 12 }}>
            <div className="field"><label>{strings.visitDate}</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="field"><label>{strings.visitTime}</label>
              <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
            <div className="field"><label>{strings.visitMessage}</label>
              <input className="input" value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            {error && <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>}
            <button className="btn" type="submit">{strings.proposeVisit}</button>
          </form>
        ) : null}
        <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
          {mine.map((v) => (
            <div key={v.id} className="card">
              <div className="card-body">
                <p style={{ margin: '0 0 4px' }}>
                  <strong>{v.date} · {v.time}</strong> — {statusLabel(v)}
                </p>
                <p className="muted" style={{ margin: '0 0 4px' }}>
                  {strings.proposedBy} @{v.tenant}
                  {v.message ? ` — ${v.message}` : ''}
                </p>
                {isOwner && v.status === 'proposed' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" type="button" onClick={() => decide(v.id, 'confirmed')} style={{ minHeight: 40, padding: '8px 16px' }}>{strings.acceptVisit}</button>
                    <button className="btn btn-secondary" type="button" onClick={() => decide(v.id, 'declined')} style={{ minHeight: 40, padding: '8px 16px' }}>{strings.declineVisit}</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {session && mine.length === 0 && <p className="muted" style={{ margin: 0 }}>{strings.noVisits}</p>}
        </div>
      </div>
    </section>
  );
}
