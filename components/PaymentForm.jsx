'use client';

import { useState } from 'react';

// Submit a MonCash/NatCash transfer reference (Phase 4). The landlord
// sends the money to the admin-set number first, then enters the
// transaction ID here; the admin confirms it against the statement.
// Prices are fixed (lib/config.js) and only displayed here.
export default function PaymentForm({ kind, listingId, amountHTG, monthOptions, monthlyHTG, destination, strings, onSubmitted }) {
  const [provider, setProvider] = useState('moncash');
  const [reference, setReference] = useState('');
  const [months, setMonths] = useState(monthOptions?.[0] || 1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const amount = kind === 'advertising' ? monthlyHTG * months : amountHTG;
  const number = provider === 'natcash' ? destination?.natcashNumber : destination?.moncashNumber;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, provider, reference, listingId, months }),
    });
    setBusy(false);
    if (!res.ok) {
      const code = (await res.json().catch(() => ({}))).error;
      setError(code === 'duplicate_reference' ? strings.payDuplicate : code === 'already_pending' ? strings.payAlreadyPending : strings.payError);
      return;
    }
    setReference('');
    onSubmitted?.((await res.json()).payment);
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
      {kind === 'advertising' && (
        <div className="field"><label>{strings.payMonths}</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {monthOptions.map((m) => (
              <button key={m} type="button" className={`slot${months === m ? ' selected' : ''}`} style={{ padding: '8px 14px' }} onClick={() => setMonths(m)}>
                {m} {strings.payMonthUnit}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 16 }}>
        <label><input type="radio" checked={provider === 'moncash'} onChange={() => setProvider('moncash')} /> MonCash</label>
        <label><input type="radio" checked={provider === 'natcash'} onChange={() => setProvider('natcash')} /> NatCash</label>
      </div>
      <p style={{ margin: 0 }}>
        1. {strings.paySendStep} <strong>{amount.toLocaleString()} HTG</strong> → <strong>{number || strings.numberNotSet}</strong>
      </p>
      <div className="field"><label>2. {strings.payReference}</label>
        <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={strings.payReferenceHint} required minLength={4} maxLength={60} autoCapitalize="characters" />
      </div>
      {error && <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>}
      <button className="btn" type="submit" disabled={busy || !number} style={{ minHeight: 40, padding: '8px 16px' }}>{strings.paySubmit}</button>
    </form>
  );
}

export function PaymentStatus({ payment, strings, locale }) {
  const label = payment.status === 'confirmed' ? strings.payConfirmed : payment.status === 'rejected' ? strings.payRejected : strings.payPending;
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      <p style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className={`status-pill ${payment.status === 'confirmed' ? 'confirmed' : payment.status === 'rejected' ? 'declined' : ''}`}>{label}</span>
        <span>{payment.amountHTG.toLocaleString()} HTG · {payment.provider === 'natcash' ? 'NatCash' : 'MonCash'} · {payment.reference}</span>
      </p>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        {payment.kind === 'advertising' ? `${strings.payKindAdvertising} (${payment.months} ${strings.payMonthUnit})` : strings.payKindActivation}
        {' · '}{new Date(payment.submittedAt).toLocaleDateString(locale === 'ht' ? 'fr' : locale)}
        {payment.note ? ` — ${payment.note}` : ''}
      </p>
    </div>
  );
}
