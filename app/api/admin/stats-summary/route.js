import { query } from '@/lib/db';

// The stats summary: the ONLY thing a scoped ('stats') admin account may
// read. Middleware lets both full and stats tokens reach this route, and
// nothing else on this route exists.
//
// The response is counts and nothing else: no usernames, no emails, no
// phones, no money, no individual rows of any kind. Visits count distinct
// people per bucket (the same definition as the Admin Board's traffic
// report), over Haiti calendar days as stored in traffic_visitors.
async function visits(bucket, days) {
  const trunc = bucket === 'daily' ? 'day' : bucket === 'weekly' ? 'week' : bucket === 'monthly' ? 'month' : 'year';
  const where = bucket === 'yearly' ? '' : `WHERE day >= CURRENT_DATE - INTERVAL '${days} days'`;
  const { rows } = await query(
    `SELECT to_char(date_trunc('${trunc}', day), 'YYYY-MM-DD') AS period,
            COUNT(DISTINCT visitor)::bigint AS visits
     FROM traffic_visitors ${where}
     GROUP BY period ORDER BY period`,
  );
  return rows.map((r) => ({ period: r.period, visits: Number(r.visits) }));
}

export async function GET() {
  const { rows } = await query('SELECT COUNT(*)::bigint AS n FROM accounts');
  return Response.json({
    accountsCreated: Number(rows[0]?.n || 0),
    visits: {
      daily: await visits('daily', 29),
      weekly: await visits('weekly', 83),
      monthly: await visits('monthly', 364),
      yearly: await visits('yearly', 0),
    },
  });
}
