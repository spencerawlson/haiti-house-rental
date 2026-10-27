'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';

// Traffic and subscriber reports: daily, weekly, monthly (migration 0012).
//
// ONE metric is plotted at a time, on purpose. Visitors run in thousands,
// subscribers in tens and revenue in tens of thousands of HTG; drawing
// them together needs either a second y-axis — which makes the crossing
// point of two lines meaningless — or a scale on which the small series
// is a flat line along the bottom. A metric picker over a single axis is
// the honest version, and the table underneath carries every series at
// once for anyone comparing them.
//
// Every figure on screen comes from the same report object the CSV is
// rendered from, so a download can never disagree with the page.

// Flows are counts of what happened and are summed over a period; stocks
// are levels and show where the period ENDED. The server already makes
// this distinction; the UI repeats it so the total line reads correctly.
const SERIES = [
  { key: 'visitors', icon: 'footprints', kind: 'flow' },
  { key: 'signups', icon: 'signup', kind: 'flow' },
  { key: 'subs_new', icon: 'star', kind: 'flow' },
  { key: 'subs_returning', icon: 'returning', kind: 'flow' },
  { key: 'subs_active', icon: 'check', kind: 'stock' },
  { key: 'subs_suspended', icon: 'pause', kind: 'flow' },
  { key: 'subs_deactivated', icon: 'stop', kind: 'flow' },
  { key: 'revenue_htg', icon: 'money', kind: 'flow' },
];

const GRAINS = ['daily', 'weekly', 'monthly'];

// Chart geometry. A viewBox plus width:100% means it scales to a phone
// without recomputing anything.
const W = 720;
const H = 190;
const PAD_T = 18;
const PAD_B = 24;
const PLOT = H - PAD_T - PAD_B;

export default function AdminTraffic({ locale, t, onCounts }) {
  const dateLocale = locale === 'ht' ? 'fr' : locale;
  const [grain, setGrain] = useState('daily');
  const [metric, setMetric] = useState('visitors');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/traffic?grain=${grain}`);
      if (res.ok) {
        const d = await res.json();
        setReport(d);
        if (d.counts && onCounts) onCounts(d.counts);
      }
    } finally {
      setLoading(false);
    }
  }, [grain, onCounts]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = report?.rows || [];
  const startsAtDeploy = (report?.metricsFromDeploy || []).includes(metric);
  const label = (k) => t[`metric_${k}`] || k;

  // Bars: one slot per bucket, 2px of surface between them so adjacent
  // fills never touch.
  const max = Math.max(1, ...rows.map((r) => Number(r[metric]) || 0));
  const slot = rows.length ? W / rows.length : W;
  const barW = Math.max(2, slot - 2);
  const peak = rows.reduce((best, r) => ((Number(r[metric]) || 0) > (Number(best?.[metric]) || -1) ? r : best), null);

  // Labels only at the ends and middle; a label under every bar on a
  // 30-day report is a grey smear.
  const tickAt = new Set(rows.length <= 3 ? rows.map((_, i) => i) : [0, Math.floor(rows.length / 2), rows.length - 1]);

  function fmt(v, key) {
    const n = Number(v) || 0;
    return key === 'revenue_htg' ? n.toLocaleString() : n.toLocaleString();
  }

  return (
    <>
      <h2 id="traffic" className="admin-h2"><Icon name="chart" /> {t.trafficTitle}</h2>
      <p className="muted">{t.trafficNote}</p>

      <div className="chip-row" style={{ marginBottom: 8 }} role="group" aria-label={t.trafficGrain}>
        {GRAINS.map((g) => (
          <button
            key={g}
            type="button"
            className="chip"
            aria-pressed={grain === g}
            onClick={() => setGrain(g)}
            style={grain === g ? { borderColor: '#dc2626', color: '#dc2626', fontWeight: 800 } : undefined}
          >
            {t[`grain_${g}`]}
          </button>
        ))}
        {report && (
          <a className="chip" href={`/api/admin/traffic?grain=${grain}&format=csv`}><Icon name="download" /> {t.downloadCsv}</a>
        )}
      </div>

      <div className="chip-row" style={{ marginBottom: 12 }} role="group" aria-label={t.trafficMetric}>
        {SERIES.map((s) => (
          <button
            key={s.key}
            type="button"
            className="chip"
            aria-pressed={metric === s.key}
            onClick={() => setMetric(s.key)}
            style={metric === s.key ? { borderColor: '#dc2626', color: '#dc2626', fontWeight: 800 } : undefined}
          >
            <Icon name={s.icon} /> {label(s.key)}
          </button>
        ))}
      </div>

      {loading && !report && <p className="muted">…</p>}

      {report && (
        <div className="card">
          <div className="card-body">
            {/* The title names the single series, so the chart needs no
                legend box — identity is never left to colour alone. */}
            <h3 style={{ margin: '0 0 2px' }}>{label(metric)}</h3>
            <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.88rem' }}>
              {t[`grain_${grain}`]} · {report.from} → {report.to}
              {' · '}
              <strong>
                {SERIES.find((s) => s.key === metric)?.kind === 'stock' ? t.levelAtEnd : t.periodTotal}:{' '}
                {fmt(report.totals?.[metric], metric)}{metric === 'revenue_htg' ? ' HTG' : ''}
              </strong>
            </p>
            {startsAtDeploy && <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.84rem' }}><Icon name="warning" /> {t.metricFromDeploy}</p>}

            {rows.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>{t.noTrafficYet}</p>
            ) : (
              <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label(metric)} — ${t[`grain_${grain}`]}`}>
                {rows.map((r, i) => {
                  const v = Number(r[metric]) || 0;
                  const h = max === 0 ? 0 : (v / max) * PLOT;
                  const x = i * slot + (slot - barW) / 2;
                  const y = PAD_T + (PLOT - h);
                  return (
                    <g key={r.period}>
                      <rect className="bar" x={x} y={y} width={barW} height={Math.max(h, v > 0 ? 1 : 0)}>
                        <title>{`${r.period} · ${fmt(v, metric)}${metric === 'revenue_htg' ? ' HTG' : ''}`}</title>
                      </rect>
                      {tickAt.has(i) && (
                        <text className="tick" x={i * slot + slot / 2} y={H - 8} textAnchor="middle">{r.period.slice(5)}</text>
                      )}
                    </g>
                  );
                })}
                {/* One direct label, on the peak: the table below has the
                    rest, and a number over every bar is noise. */}
                {peak && Number(peak[metric]) > 0 && (
                  <text
                    className="value"
                    x={rows.indexOf(peak) * slot + slot / 2}
                    y={PAD_T + (PLOT - (Number(peak[metric]) / max) * PLOT) - 5}
                    textAnchor="middle"
                  >
                    {fmt(peak[metric], metric)}
                  </text>
                )}
                <line className="axis" x1="0" y1={PAD_T + PLOT} x2={W} y2={PAD_T + PLOT} />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* The table view: every series at once, and the accessible
          alternative to reading the chart. */}
      {report && rows.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="report-scroll">
            <table className="report-table">
              <thead>
                <tr>
                  <th scope="col">{t.periodColumn}</th>
                  {SERIES.map((s) => <th key={s.key} scope="col">{label(s.key)}</th>)}
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.period}>
                    <th scope="row">{r.period}</th>
                    {SERIES.map((s) => <td key={s.key}>{fmt(r[s.key], s.key)}</td>)}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>{t.periodTotal}</td>
                  {SERIES.map((s) => <td key={s.key}>{fmt(report.totals?.[s.key], s.key)}</td>)}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
      <p className="muted" style={{ fontSize: '0.84rem' }}>{t.stockVsFlowNote}</p>
    </>
  );
}
