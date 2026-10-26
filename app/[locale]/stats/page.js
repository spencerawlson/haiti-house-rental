'use client';

import { useEffect, useState, use } from 'react';
import { getDict } from '@/lib/dictionaries';
import BackButton from '@/components/BackButton';
import Icon from '@/components/Icon';

// The stats-only page: what a scoped ('stats') admin account sees, and
// all it sees. No money, no individual accounts, no settings — just the
// number of accounts created and visits per day, per week, per month,
// and per year, from /api/admin/stats-summary.
export default function Stats(props) {
  const params = use(props.params);
  const t = getDict(params.locale);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/admin/stats-summary')
      .then((r) => { if (!r.ok) throw new Error('forbidden'); return r.json(); })
      .then(setData)
      .catch(() => setError(true));
  }, []);

  function series(title, rows) {
    return (
      <section style={{ marginBottom: 24 }}>
        <h2 className="admin-h2">{title}</h2>
        {rows && rows.length > 0 ? (
          <div className="card"><div className="card-body" style={{ display: 'grid', gap: 6 }}>
            {[...rows].reverse().map((r) => (
              <p key={r.period} style={{ margin: 0, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span>{r.period}</span><strong>{r.visits.toLocaleString()}</strong>
              </p>
            ))}
          </div></div>
        ) : (
          <p className="muted">{t.statsEmpty}</p>
        )}
      </section>
    );
  }

  return (
    <main className="container">
      <BackButton locale={params.locale} />
      <h1 className="page-title">{t.statsTitle}</h1>
      {error && <p style={{ color: '#dc2626' }}>{t.invalidAdminPassword}</p>}
      {data && (
        <>
          <div className="stat-tiles admin-tiles" style={{ marginBottom: 24 }}>
            <div className="stat-tile tone-blue"><span className="stat-icon"><Icon name="users" /></span><strong>{data.accountsCreated.toLocaleString()}</strong><span>{t.statsAccountsCreated}</span></div>
          </div>
          {series(`${t.statsVisits} · ${t.statsPerDay}`, data.visits.daily)}
          {series(`${t.statsVisits} · ${t.statsPerWeek}`, data.visits.weekly)}
          {series(`${t.statsVisits} · ${t.statsPerMonth}`, data.visits.monthly)}
          {series(`${t.statsVisits} · ${t.statsPerYear}`, data.visits.yearly)}
        </>
      )}
    </main>
  );
}
