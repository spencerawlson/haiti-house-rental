'use client';

import { useState } from 'react';

// Report a conversation or a listing to the Kay Ayiti admin. The admin
// reviews it on the Admin Board; nothing is removed automatically.
const REASONS = ['scam', 'harassment', 'spam', 'wrong_info', 'not_available', 'other'];
const REASON_KEYS = {
  scam: 'reasonScam',
  harassment: 'reasonHarassment',
  spam: 'reasonSpam',
  wrong_info: 'reasonWrongInfo',
  not_available: 'reasonNotAvailable',
  other: 'reasonOther',
};

export default function ReportForm({ kind, listingId, tenant = null, strings, onDone }) {
  const [reason, setReason] = useState('scam');
  const [details, setDetails] = useState('');
  const [state, setState] = useState('idle'); // idle | sent | error

  async function send(e) {
    e.preventDefault();
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, listingId, tenant, reason, details }),
    });
    setState(res.ok ? 'sent' : 'error');
  }

  if (state === 'sent') {
    return (
      <div className="notice" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <span>✓ {strings.reportSent}</span>
        {onDone && <button type="button" className="link-btn" onClick={onDone}>✕</button>}
      </div>
    );
  }
  return (
    <form onSubmit={send} className="card" style={{ boxShadow: 'none' }}>
      <div className="card-body" style={{ display: 'grid', gap: 10 }}>
        <div className="field"><label>{strings.reportReason}</label>
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => <option key={r} value={r}>{strings[REASON_KEYS[r]]}</option>)}
          </select>
        </div>
        <div className="field"><label>{strings.reportDetails}</label>
          <textarea className="input" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} />
        </div>
        {state === 'error' && <p style={{ color: '#dc2626', margin: 0 }}>{strings.reportError}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" type="submit" style={{ minHeight: 40, padding: '8px 16px' }}>{strings.reportSend}</button>
          {onDone && <button className="btn btn-secondary" type="button" onClick={onDone} style={{ minHeight: 40, padding: '8px 16px' }}>{strings.back}</button>}
        </div>
      </div>
    </form>
  );
}
