'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSession } from '@/lib/account';
import Icon from '@/components/Icon';

// Visit appointments on a listing (design: docs/design/app-showcase.png,
// screen 10 — month calendar, time-slot pills, optional note). A tenant
// proposes a time; the side that did NOT propose the current time
// confirms or declines; either side can cancel or propose a new time.
// The server checks every rule (lib/visits-server.js) — this UI only
// mirrors them. Both sides see the same list here and in Account.
const SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
const MAX_DAYS_AHEAD = 180;

function haitiToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Port-au-Prince' });
}

function slotLabel(slot, locale) {
  if (locale !== 'en') return slot;
  const [h, m] = slot.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function iso(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function Calendar({ value, onChange, strings }) {
  const today = haitiToday();
  const max = new Date(Date.parse(`${today}T00:00:00Z`) + MAX_DAYS_AHEAD * 86400000).toISOString().slice(0, 10);
  const [view, setView] = useState(() => {
    const [y, m] = (value || today).split('-').map(Number);
    return { y, m: m - 1 };
  });
  const first = new Date(Date.UTC(view.y, view.m, 1));
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday first, as in the design
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const step = (delta) => setView((v) => {
    const m = v.m + delta;
    return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
  });
  const atStart = iso(view.y, view.m, 1) <= today.slice(0, 8) + '01';
  const atEnd = iso(view.y, view.m, daysInMonth) >= max;
  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="link-btn" onClick={() => step(-1)} disabled={atStart} aria-label="‹">‹</button>
        <span>{strings.monthNames[view.m]} {view.y}</span>
        <button type="button" className="link-btn" onClick={() => step(1)} disabled={atEnd} aria-label="›">›</button>
      </div>
      <div className="cal-grid">
        {strings.weekdaysShort.map((d, i) => <span key={i} className="cal-dow">{d}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const day = iso(view.y, view.m, d);
          return (
            <button key={day} type="button" className={`cal-day${value === day ? ' selected' : ''}`} disabled={day < today || day > max} onClick={() => onChange(day)}>
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SlotPicker({ date, time, onDate, onTime, strings, locale }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="field"><label>{strings.visitDate}</label>
        <Calendar value={date} onChange={onDate} strings={strings} />
      </div>
      <div className="field"><label>{strings.visitTime}</label>
        <div className="slots">
          {SLOTS.map((s) => (
            <button key={s} type="button" className={`slot${time === s ? ' selected' : ''}`} onClick={() => onTime(s)}>{slotLabel(s, locale)}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function VisitScheduler({ listingId, owner, strings, locale }) {
  const [visits, setVisits] = useState([]);
  const [session, setSession] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [rescheduling, setRescheduling] = useState(null); // visit id
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');

  const isOwner = !!session && !!owner && session.username === owner;

  const load = useCallback(async () => {
    const res = await fetch(`/api/visits?listingId=${encodeURIComponent(listingId)}`);
    if (res.ok) setVisits((await res.json()).visits);
  }, [listingId]);

  useEffect(() => {
    setSession(getSession());
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const hasActive = useMemo(
    () => !!session && visits.some((v) => v.tenant === session.username && ['proposed', 'confirmed'].includes(v.status)),
    [visits, session],
  );

  function errorText(code) {
    return code === 'already_requested' ? strings.visitAlreadyRequested : strings.visitInvalid;
  }

  async function propose(e) {
    e.preventDefault();
    setError('');
    if (!date || !time) {
      setError(strings.visitInvalid);
      return;
    }
    const res = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, date, time, message }),
    });
    if (!res.ok) {
      setError(errorText((await res.json().catch(() => ({}))).error));
      return;
    }
    setDate('');
    setTime('');
    setMessage('');
    load();
  }

  async function act(id, action, extra = {}) {
    setError('');
    if (action === 'cancel' && !window.confirm(strings.cancelVisitConfirm)) return;
    const res = await fetch('/api/visits/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, ...extra }),
    });
    if (!res.ok) {
      setError(errorText((await res.json().catch(() => ({}))).error));
      return;
    }
    setRescheduling(null);
    load();
  }

  function statusLabel(v) {
    if (v.status === 'confirmed') return strings.visitConfirmed;
    if (v.status === 'declined') return strings.visitDeclined;
    if (v.status === 'cancelled') return strings.visitCancelled;
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
        ) : !isOwner && !hasActive ? (
          <form onSubmit={propose} style={{ display: 'grid', gap: 14 }}>
            <SlotPicker date={date} time={time} onDate={setDate} onTime={setTime} strings={strings} locale={locale} />
            <div className="field"><label>{strings.visitMessage}</label>
              <input className="input" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
            </div>
            <button className="btn" type="submit" disabled={!date || !time}>{strings.proposeVisit}</button>
          </form>
        ) : null}
        {error && <p style={{ color: '#dc2626', margin: '12px 0 0' }}>{error}</p>}
        <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
          {mine.map((v) => {
            const role = v.owner === session.username ? 'owner' : 'tenant';
            const active = ['proposed', 'confirmed'].includes(v.status);
            const canAnswer = v.status === 'proposed' && v.proposedBy !== role;
            return (
              <div key={v.id} className="card">
                <div className="card-body" style={{ display: 'grid', gap: 8 }}>
                  <p style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{v.date} · {slotLabel(v.time, locale)}</strong>
                    <span className={`status-pill ${v.status}`}>{statusLabel(v)}</span>
                  </p>
                  <p className="muted" style={{ margin: 0 }}>
                    {strings.proposedBy} @{v.proposedBy === 'owner' ? v.owner : v.tenant}
                    {v.message ? ` — ${v.message}` : ''}
                  </p>
                  {v.status === 'proposed' && !canAnswer && <p className="muted" style={{ margin: 0 }}><Icon name="hourglass" /> {strings.waitingOtherSide}</p>}
                  {rescheduling === v.id ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <SlotPicker date={newDate} time={newTime} onDate={setNewDate} onTime={setNewTime} strings={strings} locale={locale} />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn" type="button" disabled={!newDate || !newTime} onClick={() => act(v.id, 'reschedule', { date: newDate, time: newTime })} style={{ minHeight: 40, padding: '8px 16px' }}>{strings.saveNewTime}</button>
                        <button className="btn btn-secondary" type="button" onClick={() => setRescheduling(null)} style={{ minHeight: 40, padding: '8px 16px' }}>{strings.back}</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {canAnswer && (
                        <>
                          <button className="btn" type="button" onClick={() => act(v.id, 'confirm')} style={{ minHeight: 40, padding: '8px 16px' }}>{strings.acceptVisit}</button>
                          <button className="btn btn-secondary" type="button" onClick={() => act(v.id, 'decline')} style={{ minHeight: 40, padding: '8px 16px' }}>{strings.declineVisit}</button>
                        </>
                      )}
                      {active && (
                        <>
                          <button className="btn btn-secondary" type="button" onClick={() => { setRescheduling(v.id); setNewDate(v.date); setNewTime(''); }} style={{ minHeight: 40, padding: '8px 16px' }}>{strings.rescheduleVisit}</button>
                          <button className="btn btn-secondary" type="button" onClick={() => act(v.id, 'cancel')} style={{ minHeight: 40, padding: '8px 16px' }}>{strings.cancelVisit}</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {session && mine.length === 0 && <p className="muted" style={{ margin: 0 }}>{strings.noVisits}</p>}
        </div>
      </div>
    </section>
  );
}
